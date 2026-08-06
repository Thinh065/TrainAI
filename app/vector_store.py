from chroma_store import add_documents as add_chroma_documents, search_similar_documents as search_chroma_documents


def add_documents(documents, embeddings, metadata=None):
    """
    Lưu các chunks và embeddings vào ChromaDB.
    """
    embedding_list = embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings
    metadata = metadata or [{} for _ in documents]
    add_chroma_documents(documents=documents, embeddings=embedding_list, metadata=metadata)


def search_similar_documents(query_embedding, top_k=5, user_id=None, conversation_id=None):
    """
    Tìm các chunks gần nhất với câu hỏi.
    """
    embedding_list = query_embedding.tolist() if hasattr(query_embedding, "tolist") else query_embedding
    return search_chroma_documents(embedding_list, user_id=user_id, conversation_id=conversation_id, top_k=top_k)