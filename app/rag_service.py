import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from dotenv import load_dotenv

import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.chatbot import ask_chatbot
from app.chroma_store import add_documents as add_chroma_documents, count_documents_for_file, delete_documents_by_conversation, delete_documents_by_file_id, get_conversation_documents, search_similar_documents as search_chroma_documents
from app.embedding import create_embeddings, create_query_embedding
from app.keyword_search import bm25_rank, reciprocal_rank_fusion
from app.mongo_store import add_file_record, add_message, delete_conversation, delete_file_record, get_file_by_id, get_files_for_conversation, get_messages
from app.pdf_processor import chunk_text, compute_file_id, extract_text_from_pdf

load_dotenv(os.path.join(BASE_DIR, ".env"))

logger = logging.getLogger(__name__)


def remove_local_file(file_path: str | None) -> None:
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            logger.warning("Could not remove local PDF file: %s", file_path)


def ingest_pdf(user_id: str, conversation_id: str, pdf_path: str, file_name: str, file_id: str | None = None) -> Dict[str, Any]:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file does not exist: {pdf_path}")

    file_id = file_id or compute_file_id(pdf_path)
    existing_file = get_file_by_id(user_id, conversation_id, file_id)
    if existing_file is not None:
        kept_path = existing_file.get("file_path")
        if not (kept_path and os.path.exists(kept_path)):
            kept_path = pdf_path
        # Same content is already here: keep one copy on disk.
        if os.path.abspath(kept_path) != os.path.abspath(pdf_path):
            remove_local_file(pdf_path)
        if count_documents_for_file(user_id, conversation_id, file_id) > 0:
            return {
                "file_id": file_id,
                "file_name": file_name,
                "chunks_indexed": 0,
                "already_indexed": True,
            }
        # Recorded but never indexed (the old duplicate-id bug): index the kept copy again.
        pdf_path = kept_path

    pages = extract_text_from_pdf(pdf_path)
    if not pages:
        raise ValueError("PDF does not contain extractable text")

    chunks = []
    metadata = []
    for page in pages:
        page_number = page["page_number"]
        page_text = page["text"].strip()
        if not page_text:
            continue

        page_chunks = chunk_text(page_text, chunk_size=700, chunk_overlap=120)
        for idx, chunk in enumerate(page_chunks):
            source_prefix = f"Trang {page_number} - {file_name}\n\n"
            document_text = f"{source_prefix}{chunk}".strip()
            chunks.append(document_text)
            metadata.append(
                {
                    "user_id": str(user_id),
                    "conversation_id": str(conversation_id),
                    "file_id": str(file_id),
                    "file_name": file_name,
                    "page_number": page_number,
                    "chunk_index": idx,
                    "source": f"{file_name} - Trang {page_number}",
                    "upload_time": datetime.now(timezone.utc).isoformat(),
                }
            )

    if not chunks:
        raise ValueError("No textual chunks were generated from the PDF")

    embeddings = create_embeddings(chunks)
    try:
        add_chroma_documents(documents=chunks, embeddings=embeddings.tolist(), metadata=metadata)
    except Exception:
        # A failed batch must not leave half a PDF searchable.
        delete_documents_by_file_id(user_id, conversation_id, file_id)
        raise
    if existing_file is None:
        add_file_record(user_id=user_id, conversation_id=conversation_id, file_name=file_name, file_path=pdf_path, file_id=file_id)

    return {
        "file_id": file_id,
        "file_name": file_name,
        "chunks_indexed": len(chunks),
        "already_indexed": False,
    }


def delete_pdf(user_id: str, conversation_id: str, file_id: str) -> Dict[str, Any]:
    existing_file = get_file_by_id(user_id, conversation_id, file_id)
    if existing_file is None:
        return {
            "deleted": False,
            "file_id": str(file_id),
            "chunks_removed": 0,
        }

    chunks_removed = delete_documents_by_file_id(user_id, conversation_id, file_id)
    deleted = delete_file_record(user_id, conversation_id, file_id)
    remove_local_file(existing_file.get("file_path"))

    return {
        "deleted": deleted,
        "file_id": str(file_id),
        "file_name": existing_file.get("file_name"),
        "chunks_removed": chunks_removed,
    }


def delete_conversation_data(user_id: str, conversation_id: str) -> Dict[str, Any]:
    """Xóa mọi dữ liệu RAG của một cuộc trò chuyện: chunks, file PDF, bản ghi Mongo."""
    files = get_files_for_conversation(user_id, conversation_id)
    chunks_removed = delete_documents_by_conversation(user_id, conversation_id)
    for record in files:
        remove_local_file(record.get("file_path"))
    delete_conversation(user_id, conversation_id)
    return {
        "conversation_id": str(conversation_id),
        "files_removed": len(files),
        "chunks_removed": chunks_removed,
    }


def _unique_sources(retrieved: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Một nguồn cho mỗi (file, trang), theo thứ tự liên quan."""
    seen = set()
    sources = []
    for item in retrieved:
        meta = item.get("metadata") or {}
        key = (meta.get("file_id"), meta.get("page_number"))
        if not item.get("document") or key in seen:
            continue
        seen.add(key)
        sources.append(
            {
                "file_id": meta.get("file_id"),
                "file_name": meta.get("file_name") or "PDF",
                "page_number": meta.get("page_number"),
            }
        )
    return sources


CONTEXT_PASSAGES = 8
CANDIDATES_PER_METHOD = 20


def _passage_key(meta: Dict[str, Any]) -> str:
    return f"{meta.get('file_id')}-{meta.get('page_number')}-{meta.get('chunk_index')}"


def retrieve_passages(user_id: str, conversation_id: str, question: str) -> List[Dict[str, Any]]:
    """Tìm theo nghĩa (vector) và theo từ khóa (BM25), rồi gộp hai bảng xếp hạng.

    Chỉ tìm theo nghĩa thì bỏ sót đoạn có đúng chữ trong câu hỏi
    (năm, tên riêng, số liệu); từ khóa bù vào chỗ đó.
    """
    query_embedding = create_query_embedding(question)
    by_meaning = search_chroma_documents(
        query_embedding.tolist(), user_id=user_id, conversation_id=conversation_id, top_k=CANDIDATES_PER_METHOD
    )
    passages = get_conversation_documents(user_id, conversation_id)
    by_keyword = [passages[i] for i in bm25_rank(question, [p["document"] for p in passages])[:CANDIDATES_PER_METHOD]]

    pool = {_passage_key(p.get("metadata") or {}): p for p in by_meaning + by_keyword}
    fused = reciprocal_rank_fusion(
        [[_passage_key(p.get("metadata") or {}) for p in ranking] for ranking in (by_meaning, by_keyword)]
    )
    return [pool[key] for key in fused[:CONTEXT_PASSAGES]]


HISTORY_MESSAGES = 8
HISTORY_CHARS_PER_MESSAGE = 2000


def answer_question(
    user_id: str,
    conversation_id: str,
    question: str,
    history: List[Dict[str, str]] | None = None,
) -> Dict[str, Any]:
    """Trả lời từ PDF của cuộc trò chuyện.

    `history` do web gửi kèm (nơi lưu tin nhắn chính). Không có thì dùng lịch sử
    Python tự lưu, cho các lệnh chạy riêng như app/main.py.
    """
    if not question or not question.strip():
        raise ValueError("Question is required")

    caller_owns_history = history is not None
    if history is None:
        history = get_messages(conversation_id, user_id)
    history_text = "\n".join(
        f"{msg.get('role')}: {str(msg.get('content', ''))[:HISTORY_CHARS_PER_MESSAGE]}"
        for msg in history[-HISTORY_MESSAGES:]
    )

    retrieved = retrieve_passages(user_id, conversation_id, question)

    context_items = []
    for item in retrieved:
        document = item.get("document")
        meta = item.get("metadata") or {}
        if not document:
            continue
        source = meta.get("source") or f"{meta.get('file_name', 'PDF')} - Trang {meta.get('page_number', '?')}"
        context_items.append(f"**Nguồn:** {source}\n\n{document}")

    context_text = "\n\n---\n\n".join(context_items) if context_items else "(Cuộc trò chuyện này chưa có tài liệu PDF nào.)"

    prompt = f"""
Bạn là trợ lý AI hỗ trợ trả lời câu hỏi dựa trên các tài liệu PDF đã được tải lên.
Hãy chỉ sử dụng thông tin nằm trong phần "Ngữ liệu liên quan" để trả lời. Nếu thông tin không có trong dữ liệu, hãy trả lời chính xác rằng bạn không tìm thấy câu trả lời và không bịa đặt.

Yêu cầu định dạng:
- Trả lời dưới dạng Markdown hợp lệ.
- Sử dụng định dạng tiêu đề, danh sách, bảng, mã, hoặc in đậm nếu cần.
- Kết quả phải tương thích với ReactMarkdown và remark-gfm.
- Không cần liệt kê lại nguồn ở cuối; giao diện tự hiển thị nguồn.
- Không dùng LaTeX hay ký hiệu $...$ (giao diện không hiển thị được). Viết phép tính bằng ký hiệu thường, ví dụ: 1.650.000 × 9 = 14.850.000 đồng.

Lịch sử hội thoại:
{history_text}

Ngữ liệu liên quan:
{context_text}

Câu hỏi:
{question}
"""

    answer = ask_chatbot(prompt)

    if not caller_owns_history:
        add_message(conversation_id=conversation_id, user_id=user_id, role="user", content=question)
        add_message(conversation_id=conversation_id, user_id=user_id, role="assistant", content=answer)

    return {
        "answer": answer,
        "context_used": len(context_items),
        "conversation_id": conversation_id,
        "sources": _unique_sources(retrieved),
        "retrieved_sources": [item.get("metadata") for item in retrieved],
    }
