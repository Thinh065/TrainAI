import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "trainai")

logger = logging.getLogger(__name__)

_client: Optional[MongoClient] = None
_db = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is not configured")
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    return _client


def get_db():
    global _db
    if _db is None:
        _db = get_client()[MONGODB_DATABASE]
    return _db


def ensure_indexes() -> None:
    db = get_db()
    db.conversations.create_index("user_id")
    db.conversations.create_index("created_at")
    db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    db.messages.create_index("user_id")
    db.files.create_index([("conversation_id", 1), ("user_id", 1)])


try:
    ensure_indexes()
except Exception as exc:  # pragma: no cover - defensive initialization
    logger.warning("MongoDB indexes could not be created: %s", exc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if doc is None:
        return None
    data = dict(doc)
    if "_id" in data:
        data["_id"] = str(data["_id"])
    return data


def _serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [_serialize_doc(doc) for doc in docs]


def _parse_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value)
    except Exception:
        return None


def create_conversation(user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
    if not user_id or not str(user_id).strip():
        raise ValueError("user_id is required")

    doc = {
        "user_id": str(user_id).strip(),
        "title": title or "New Chat",
        "created_at": _now(),
        "updated_at": _now(),
    }
    result = get_db().conversations.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


def get_conversations(user_id: str) -> List[Dict[str, Any]]:
    docs = list(get_db().conversations.find({"user_id": str(user_id).strip()}).sort("updated_at", -1))
    return _serialize_docs(docs)


def _build_user_filter(user_id: str) -> Dict[str, Any]:
    trimmed = str(user_id).strip()
    filters = [
        {"user_id": trimmed},
        {"userId": trimmed},
    ]
    object_id = _parse_object_id(trimmed)
    if object_id is not None:
        filters.extend([
            {"user_id": object_id},
            {"userId": object_id},
        ])
    return {"$or": filters}


def get_conversation(user_id: str, conversation_id: str) -> Optional[Dict[str, Any]]:
    _id = _parse_object_id(conversation_id)
    if _id is None:
        return None
    query = {"_id": _id, **_build_user_filter(user_id)}
    doc = get_db().conversations.find_one(query)
    return _serialize_doc(doc)


def update_conversation_title(user_id: str, conversation_id: str, title: str) -> Optional[Dict[str, Any]]:
    _id = _parse_object_id(conversation_id)
    if _id is None:
        return None
    query = {"_id": _id, **_build_user_filter(user_id)}
    result = get_db().conversations.find_one_and_update(
        query,
        {"$set": {"title": title, "updated_at": _now()}},
        return_document=True,
    )
    return _serialize_doc(result)


def delete_conversation(user_id: str, conversation_id: str) -> bool:
    _id = _parse_object_id(conversation_id)
    if _id is None:
        return False
    db = get_db()
    filter_query = {"conversation_id": str(conversation_id), **_build_user_filter(user_id)}
    db.messages.delete_many(filter_query)
    db.files.delete_many(filter_query)
    result = db.conversations.delete_one({"_id": _id, **_build_user_filter(user_id)})
    return result.deleted_count > 0


def add_message(conversation_id: str, user_id: str, role: str, content: str) -> Dict[str, Any]:
    doc = {
        "conversation_id": str(conversation_id),
        "user_id": str(user_id).strip(),
        "role": role,
        "content": content,
        "created_at": _now(),
    }
    result = get_db().messages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


def get_messages(conversation_id: str, user_id: str) -> List[Dict[str, Any]]:
    docs = list(
        get_db().messages.find({"conversation_id": str(conversation_id), "user_id": str(user_id).strip()}).sort("created_at", 1)
    )
    return _serialize_docs(docs)


def add_file_record(user_id: str, conversation_id: str, file_name: str, file_path: str, file_id: str) -> Dict[str, Any]:
    doc = {
        "user_id": str(user_id).strip(),
        "conversation_id": str(conversation_id),
        "file_id": str(file_id),
        "file_name": file_name,
        "file_path": file_path,
        "created_at": _now(),
    }
    result = get_db().files.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_doc(doc)


def get_files_for_conversation(user_id: str, conversation_id: str) -> List[Dict[str, Any]]:
    docs = list(
        get_db().files.find({"conversation_id": str(conversation_id), "user_id": str(user_id).strip()}).sort("created_at", -1)
    )
    return _serialize_docs(docs)


def get_file_by_id(user_id: str, conversation_id: str, file_id: str) -> Optional[Dict[str, Any]]:
    doc = get_db().files.find_one(
        {
            "file_id": str(file_id),
            "conversation_id": str(conversation_id),
            "user_id": str(user_id).strip(),
        }
    )
    return _serialize_doc(doc)


def ping() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception as exc:  # pragma: no cover - runtime connection check
        logger.warning("MongoDB ping failed: %s", exc)
        return False
