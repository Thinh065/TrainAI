import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.rag_service import answer_question, ingest_pdf

PDF_PATH = os.path.join(BASE_DIR, "data", "bieu_phi_esh_nam_hoc_2025_2026.pdf")

if __name__ == "__main__":
    user_id = input("user_id: ").strip() or "demo-user"
    conversation_id = input("conversation_id (leave empty to create a new one): ").strip() or "demo-conversation"

    if os.path.exists(PDF_PATH):
        ingest_pdf(user_id=user_id, conversation_id=conversation_id, pdf_path=PDF_PATH, file_name="sample.pdf", file_id="demo-file")

    question = input("Nhập câu hỏi: ").strip()
    if question:
        result = answer_question(user_id=user_id, conversation_id=conversation_id, question=question)
        print(result["answer"])
