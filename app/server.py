import logging
import os
import sys
import uuid
from pathlib import Path

from flask import Flask, jsonify, request
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.mongo_store import create_conversation, delete_conversation, get_conversation, get_conversations, get_files_for_conversation, get_messages
from app.rag_service import answer_question, ingest_pdf

load_dotenv(os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


@app.route("/")
def home():
    return app.send_static_file("index.html")


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

    deleted = delete_conversation(user_id, conversation_id)
    if not deleted:
        return jsonify({"error": "Conversation not found or not accessible"}), 404

    return jsonify({"deleted": True, "conversation_id": conversation_id})


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

    file_name = os.path.basename(uploaded_file.filename)
    safe_name = file_name.replace(" ", "_")
    conversation_dir = os.path.join(UPLOAD_DIR, str(user_id), str(conversation_id))
    Path(conversation_dir).mkdir(parents=True, exist_ok=True)
    file_path = os.path.join(conversation_dir, safe_name)
    uploaded_file.save(file_path)

    try:
        result = ingest_pdf(user_id=user_id, conversation_id=conversation_id, pdf_path=file_path, file_name=safe_name, file_id=None)
        return jsonify({"message": "PDF processed successfully", **result}), 201
    except Exception as exc:
        logger.exception("Failed to index uploaded PDF")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/conversations/<conversation_id>/files", methods=["GET"])
def list_conversation_files(conversation_id):
    user_id = request.args.get("user_id", "").strip()
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    return jsonify(get_files_for_conversation(user_id, conversation_id))


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
    app.run(host="0.0.0.0", port=8501, debug=True)
