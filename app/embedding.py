import os
import sys

from sentence_transformers import SentenceTransformer

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
_model = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def create_embeddings(texts):
    """
    Chuyển danh sách các đoạn text thành vector embeddings.
    """
    model = _get_model()
    return model.encode(texts, convert_to_numpy=True)


def create_query_embedding(query):
    """
    Chuyển câu hỏi của người dùng thành vector embedding.
    """
    model = _get_model()
    return model.encode(query, convert_to_numpy=True)