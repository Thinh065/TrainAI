import json
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


class ChatbotError(RuntimeError):
    """Raised when the model cannot produce an answer."""


def _generation_error(exc: Exception) -> ChatbotError:
    """Lỗi Gemini viết lại cho người dùng đọc được."""
    text = str(exc)
    if "429" in text or "RESOURCE_EXHAUSTED" in text:
        if "PerDay" in text or "per day" in text:
            return ChatbotError(f"Gemini ({MODEL_NAME}) đã hết lượt miễn phí của hôm nay. Thử lại vào ngày mai, đổi AI_MODEL_NAME hoặc nâng gói.")
        return ChatbotError("Gemini đang giới hạn số lượt mỗi phút. Đợi khoảng một phút rồi thử lại.")
    if "503" in text or "UNAVAILABLE" in text:
        return ChatbotError("Gemini đang quá tải. Thử lại sau ít phút.")
    return ChatbotError(f"Gemini không trả lời được: {text[:300]}")


def ask_chatbot(prompt_or_question, relevant_chunks=None):
    """
    Gửi câu hỏi hoặc prompt đã được xây dựng sẵn tới Gemini.
    Ném ChatbotError khi model lỗi, để lỗi không bị lưu như một câu trả lời.
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

    if client is None:
        raise ChatbotError("Chưa cấu hình AI_API_KEY cho Gemini")

    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt_content)
    except Exception as exc:
        logger.exception("AI generation failed")
        raise _generation_error(exc) from exc

    answer = (getattr(response, "text", None) or "").strip()
    if not answer:
        raise ChatbotError("Gemini trả về câu trả lời trống")
    return answer


def ask_chatbot_json(prompt: str) -> dict:
    """Gửi prompt và nhận về JSON (Gemini ở chế độ trả JSON)."""
    if client is None:
        raise ChatbotError("Chưa cấu hình AI_API_KEY cho Gemini")

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=genai.types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
        )
    except Exception as exc:
        logger.exception("AI generation failed")
        raise _generation_error(exc) from exc

    try:
        return json.loads(getattr(response, "text", None) or "")
    except ValueError as exc:
        raise ChatbotError("Gemini trả về kết quả không đúng định dạng") from exc
