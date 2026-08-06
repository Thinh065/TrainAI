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
from app.chroma_store import add_documents as add_chroma_documents, search_similar_documents as search_chroma_documents
from app.embedding import create_embeddings, create_query_embedding
from app.mongo_store import add_file_record, add_message, get_conversation, get_file_by_id, get_messages, update_conversation_title
from app.pdf_processor import chunk_text, compute_file_id, extract_text_from_pdf

load_dotenv(os.path.join(BASE_DIR, ".env"))

logger = logging.getLogger(__name__)


def ingest_pdf(user_id: str, conversation_id: str, pdf_path: str, file_name: str, file_id: str | None = None) -> Dict[str, Any]:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file does not exist: {pdf_path}")

    file_id = file_id or compute_file_id(pdf_path)
    existing_file = get_file_by_id(user_id, conversation_id, file_id)
    if existing_file is not None:
        return {
            "file_id": file_id,
            "file_name": file_name,
            "chunks_indexed": 0,
            "already_indexed": True,
        }

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
    add_chroma_documents(documents=chunks, embeddings=embeddings.tolist(), metadata=metadata)
    add_file_record(user_id=user_id, conversation_id=conversation_id, file_name=file_name, file_path=pdf_path, file_id=file_id)

    return {
        "file_id": file_id,
        "file_name": file_name,
        "chunks_indexed": len(chunks),
        "already_indexed": False,
    }


def answer_question(user_id: str, conversation_id: str, question: str) -> Dict[str, Any]:
    if not question or not question.strip():
        raise ValueError("Question is required")

    conversation = get_conversation(user_id, conversation_id)
    if not conversation:
        logger.info(
            "Conversation %s for user %s not found in Python store; continuing without conversation record",
            conversation_id,
            user_id,
        )

    history = get_messages(conversation_id, user_id)
    history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history[-8:]])

    query_embedding = create_query_embedding(question)
    retrieved = search_chroma_documents(query_embedding.tolist(), user_id=user_id, conversation_id=conversation_id, top_k=4)

    context_items = []
    for item in retrieved:
        document = item.get("document")
        meta = item.get("metadata") or {}
        if not document:
            continue
        source = meta.get("source") or f"{meta.get('file_name', 'PDF')} - Trang {meta.get('page_number', '?')}"
        context_items.append(f"**Nguồn:** {source}\n\n{document}")

    context_text = "\n\n---\n\n".join(context_items) if context_items else ""

    prompt = f"""
Bạn là trợ lý AI hỗ trợ trả lời câu hỏi dựa trên các tài liệu PDF đã được tải lên.
Hãy chỉ sử dụng thông tin nằm trong phần "Ngữ liệu liên quan" để trả lời. Nếu thông tin không có trong dữ liệu, hãy trả lời chính xác rằng bạn không tìm thấy câu trả lời và không bịa đặt.

Yêu cầu định dạng:
- Trả lời dưới dạng Markdown hợp lệ.
- Sử dụng định dạng tiêu đề, danh sách, bảng, mã, hoặc in đậm nếu cần.
- Kết quả phải tương thích với ReactMarkdown và remark-gfm.

Lịch sử hội thoại:
{history_text}

Ngữ liệu liên quan:
{context_text}

Câu hỏi:
{question}
"""

    answer = ask_chatbot(prompt)

    add_message(conversation_id=conversation_id, user_id=user_id, role="user", content=question)
    add_message(conversation_id=conversation_id, user_id=user_id, role="assistant", content=answer)

    if conversation is not None:
        update_conversation_title(user_id, conversation_id, question[:50])

    return {
        "answer": answer,
        "context_used": len(context_items),
        "conversation_id": conversation_id,
        "retrieved_sources": [item.get("metadata") for item in retrieved],
    }
