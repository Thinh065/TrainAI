import logging
import os
import sys
import google.genai as genai
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

load_dotenv(os.path.join(BASE_DIR, ".env"))


logger = logging.getLogger(__name__)

AI_API_KEY = os.getenv("AI_API_KEY") or os.getenv("GOOGLE_API_KEY")
MODEL_NAME = os.getenv("AI_MODEL_NAME", "gemini-3.6-flash")

if AI_API_KEY:
    client = genai.Client(api_key=AI_API_KEY)
    logger.info("Using AI model: %s", MODEL_NAME)
else:
    client = None
    logger.warning("No AI API key configured; Gemini requests will fail.")


def ask_chatbot(prompt_or_question, relevant_chunks=None):
    """
    Gửi câu hỏi hoặc prompt đã được xây dựng sẵn tới Gemini.
    """
    if relevant_chunks is not None:
        context = "\n\n".join(relevant_chunks if isinstance(relevant_chunks, list) else [str(relevant_chunks)])
        prompt_content = f"""
Bạn là một trợ lý AI được đào tạo để trả lời các câu hỏi dựa trên ngữ liệu được cung cấp.
Chỉ sử dụng thông tin trong phần "Thông tin" để trả lời. Nếu câu hỏi không có đáp án trong tài liệu, hãy trả lời rằng bạn không thể tìm thấy thông tin phù hợp và không bịa đặt.

Thông tin:
{context}

Câu hỏi:
{prompt_or_question}

Câu trả lời:
"""
    else:
        prompt_content = prompt_or_question

    try:
        if client is None:
            raise RuntimeError("AI API key is not configured")

        chat = client.chats.create(model=MODEL_NAME)
        response = chat.send_message(prompt_content)
        return getattr(response, "text", "").strip()
    except Exception as exc:  # pragma: no cover - runtime fallback
        logger.exception("AI generation failed")
        return f"Hiện tại tôi không thể trả lời câu hỏi này: {exc}"