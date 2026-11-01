import logging
import os
import re
import sys
import uuid
from pathlib import Path
from flask_cors import CORS

from flask import Flask, jsonify, request
from dotenv import load_dotenv
from werkzeug.exceptions import RequestEntityTooLarge

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.chatbot import ChatbotError
from app.consistency_jobs import get_job, start_job
from app.mongo_store import create_conversation, get_conversation, get_conversations, get_files_for_conversation, get_messages
from app.rag_service import answer_question, delete_conversation_data, delete_pdf, ingest_pdf, remove_local_file

load_dotenv(os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = os.path.join(BASE_DIR, "web")
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app)
MAX_UPLOAD_MB = 16
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# Ids end up in filesystem paths, so only allow plain id characters.
_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _is_valid_id(value: str) -> bool:
    return bool(_ID_PATTERN.match(value or ""))


@app.errorhandler(RequestEntityTooLarge)
def file_too_large(_exc):
    return jsonify({"error": f"File quá lớn. Giới hạn {MAX_UPLOAD_MB} MB."}), 413


@app.route("/")
def home():
    return jsonify({
        "message": "TrainAI Backend is running"
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/conversations", methods=["POST"])
def create_new_conversation():
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conversation = create_conversation(user_id=user_id, title=data.get("title") or "New Chat")
    return jsonify(conversation), 201


@app.route("/api/conversations", methods=["GET"])
def list_conversations():
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    return jsonify(get_conversations(user_id))


@app.route("/api/conversations/<conversation_id>", methods=["GET"])
def get_single_conversation(conversation_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    conversation = get_conversation(user_id, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found or not accessible"}), 404

    return jsonify(conversation)


@app.route("/api/conversations/<conversation_id>", methods=["DELETE"])
def delete_single_conversation(conversation_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if not _is_valid_id(user_id) or not _is_valid_id(conversation_id):
        return jsonify({"error": "Invalid user_id or conversation_id"}), 400

    try:
        return jsonify({"deleted": True, **delete_conversation_data(user_id, conversation_id)})
    except Exception as exc:
        logger.exception("Failed to delete conversation data")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>/files", methods=["POST"])
def upload_pdf(conversation_id):
    user_id = request.form.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    if not request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files.get("file")
    if not uploaded_file or uploaded_file.filename == "":
        return jsonify({"error": "No file uploaded"}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    if not _is_valid_id(user_id) or not _is_valid_id(conversation_id):
        return jsonify({"error": "Invalid user_id or conversation_id"}), 400

    file_name = os.path.basename(uploaded_file.filename.replace("\\", "/"))
    safe_name = file_name.replace(" ", "_")
    conversation_dir = os.path.join(UPLOAD_DIR, user_id, conversation_id)
    Path(conversation_dir).mkdir(parents=True, exist_ok=True)
    # Unique prefix: two different PDFs with the same name must not overwrite each other.
    file_path = os.path.join(conversation_dir, f"{uuid.uuid4().hex[:12]}_{safe_name}")
    uploaded_file.save(file_path)

    try:
        result = ingest_pdf(user_id=user_id, conversation_id=conversation_id, pdf_path=file_path, file_name=safe_name, file_id=None)
        status = 200 if result.get("already_indexed") else 201
        return jsonify({"message": "PDF processed successfully", **result}), status
    except ValueError as exc:
        remove_local_file(file_path)
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        remove_local_file(file_path)
        logger.exception("Failed to index uploaded PDF")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>/files", methods=["GET"])
def list_conversation_files(conversation_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    return jsonify({"files": get_files_for_conversation(user_id, conversation_id)})


@app.route("/api/conversations/<conversation_id>/files/<file_id>", methods=["DELETE"])
def delete_conversation_file(conversation_id, file_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if not _is_valid_id(user_id) or not _is_valid_id(conversation_id):
        return jsonify({"error": "Invalid user_id or conversation_id"}), 400

    try:
        result = delete_pdf(user_id=user_id, conversation_id=conversation_id, file_id=file_id)
        return jsonify(result), 200 if result.get("deleted") else 404
    except Exception as exc:
        logger.exception("Failed to delete PDF")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/consistency", methods=["POST"])
def start_consistency_check():
    """Bắt đầu kiểm tra ở nền; trả job_id để hỏi tiến độ."""
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    user_id = (data.get("user_id") or "").strip()
    if not url or not user_id:
        return jsonify({"error": "url và user_id là bắt buộc"}), 400
    return jsonify({"job_id": start_job(url, owner=user_id)}), 202


@app.route("/api/consistency/<job_id>", methods=["GET"])
def consistency_status(job_id):
    job = get_job(job_id, owner=request.args.get("user_id", "").strip())
    if job is None:
        return jsonify({"error": "Không tìm thấy lượt kiểm tra (có thể máy chủ vừa khởi động lại)"}), 404
    return jsonify(job)


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    user_id = (data.get("user_id") or "").strip()
    conversation_id = (data.get("conversation_id") or "").strip()
    message = (data.get("message") or "").strip()

    if not user_id or not conversation_id or not message:
        return jsonify({"error": "user_id, conversation_id, and message are required"}), 400

    try:
        result = answer_question(user_id=user_id, conversation_id=conversation_id, question=message)
        return jsonify(result)
    except PermissionError as exc:
        return jsonify({"error": str(exc)}), 403
    except ChatbotError as exc:
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        logger.exception("Chat request failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>/messages", methods=["GET"])
def list_messages(conversation_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    return jsonify(get_messages(conversation_id, user_id))


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8501)),
        debug=False
    )