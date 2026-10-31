import logging
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

try:
    import chromadb
except Exception as exc:  # pragma: no cover - optional dependency
    chromadb = None
    CHROMA_IMPORT_ERROR = exc
else:
    CHROMA_IMPORT_ERROR = None

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))

logger = logging.getLogger(__name__)

CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")
CHROMA_TENANT = os.getenv("CHROMA_TENANT")
CHROMA_DATABASE = os.getenv("CHROMA_DATABASE", "Train")

_client = None
_collection = None


def get_client():
    global _client
    if _client is not None:
        return _client
    if chromadb is None:
        raise RuntimeError(f"chromadb package is not available: {CHROMA_IMPORT_ERROR}")

    if CHROMA_API_KEY and CHROMA_TENANT:
        _client = chromadb.CloudClient(
            api_key=CHROMA_API_KEY,
            tenant=CHROMA_TENANT,
            database=CHROMA_DATABASE,
        )
    else:
        _client = chromadb.PersistentClient(path=os.path.join(BASE_DIR, "chroma_db"))
    return _client


def get_collection():
    global _collection
    if _collection is None:
        client = get_client()
        _collection = client.get_or_create_collection(name="trainai_knowledge")
    return _collection


def add_documents(documents: List[str], embeddings: List[List[float]], metadata: List[Dict[str, Any]]) -> None:
    if not documents:
        return
    collection = get_collection()
    # The same PDF can be uploaded to several conversations, so the id must include the conversation.
    ids = [
        f"{meta.get('conversation_id', 'conv')}-{meta.get('file_id', 'file')}-{meta.get('page_number', 0)}-{meta.get('chunk_index', idx)}"
        for idx, meta in enumerate(metadata)
    ]
    collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadata)


def search_similar_documents(query_embedding: List[float], user_id: str, conversation_id: str | None = None, top_k: int = 5) -> List[Dict[str, Any]]:
    collection = get_collection()
    if conversation_id is not None:
        where = {"$and": [{"user_id": user_id}, {"conversation_id": conversation_id}]}
    else:
        where = {"user_id": user_id}

    # No fallback to the user's other conversations: their PDFs must not leak into this one.
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
    )

    documents = (results.get("documents") or [[]])[0]
    metadatas = (results.get("metadatas") or [[]])[0]
    distances = (results.get("distances") or [[]])[0]
    return [
        {
            "document": doc,
            "metadata": meta,
            "distance": dist,
        }
        for doc, meta, dist in zip(documents, metadatas, distances)
    ]


def _delete_where(where: Dict[str, Any]) -> int:
    collection = get_collection()
    # "ids" is always returned and is not a valid include value.
    records = collection.get(where=where, include=[])
    ids = records.get("ids", [])
    if ids:
        collection.delete(ids=ids)
    return len(ids)


def delete_documents_by_file_id(user_id: str, conversation_id: str, file_id: str) -> int:
    return _delete_where(
        {
            "$and": [
                {"user_id": str(user_id)},
                {"conversation_id": str(conversation_id)},
                {"file_id": str(file_id)},
            ]
        }
    )


def count_documents_for_file(user_id: str, conversation_id: str, file_id: str) -> int:
    records = get_collection().get(
        where={
            "$and": [
                {"user_id": str(user_id)},
                {"conversation_id": str(conversation_id)},
                {"file_id": str(file_id)},
            ]
        },
        include=[],
    )
    return len(records.get("ids", []))


def delete_documents_by_conversation(user_id: str, conversation_id: str) -> int:
    return _delete_where({"$and": [{"user_id": str(user_id)}, {"conversation_id": str(conversation_id)}]})


def delete_collection() -> None:
    client = get_client()
    client.delete_collection(name="trainai_knowledge")


def ping() -> bool:
    try:
        get_collection()
        return True
    except Exception as exc:  # pragma: no cover - runtime connection check
        logger.warning("ChromaDB ping failed: %s", exc)
        return False
