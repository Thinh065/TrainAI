import math
import re
from collections import Counter
from typing import Dict, List, Sequence

# Question words that say nothing about where the answer is.
_STOPWORDS = {
    "là", "bao", "nhiêu", "nào", "gì", "của", "và", "có", "được", "các", "những", "đâu",
    "khi", "ở", "cho", "vào", "từ", "thế", "sao", "ai", "không", "này", "đó", "với",
    "một", "the", "a", "an", "of", "is", "what", "how", "when", "where",
}


def tokenize(text: str) -> List[str]:
    """Âm tiết thường (giữ dấu) cộng cặp âm tiết liền nhau, để "dời đô" khớp cả cụm."""
    words = [w for w in re.findall(r"\w+", text.lower()) if w not in _STOPWORDS]
    return words + [f"{a} {b}" for a, b in zip(words, words[1:])]


def bm25_rank(query: str, documents: Sequence[str], k1: float = 1.5, b: float = 0.75) -> List[int]:
    """Chỉ số các đoạn khớp từ khóa, xếp theo điểm BM25 giảm dần (bỏ đoạn điểm 0)."""
    query_terms = set(tokenize(query))
    if not query_terms or not documents:
        return []

    doc_terms = [Counter(tokenize(doc)) for doc in documents]
    avg_len = sum(sum(t.values()) for t in doc_terms) / len(doc_terms) or 1.0
    doc_freq: Dict[str, int] = Counter(term for t in doc_terms for term in query_terms if term in t)

    scores = []
    for index, terms in enumerate(doc_terms):
        length = sum(terms.values())
        score = 0.0
        for term in query_terms:
            tf = terms.get(term, 0)
            if not tf:
                continue
            idf = math.log(1 + (len(documents) - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * length / avg_len))
        if score > 0:
            scores.append((score, index))

    return [index for _, index in sorted(scores, reverse=True)]


def reciprocal_rank_fusion(rankings: Sequence[Sequence[str]], k: int = 60) -> List[str]:
    """Gộp nhiều bảng xếp hạng: đoạn đứng cao ở bảng nào cũng được cộng điểm."""
    scores: Dict[str, float] = {}
    for ranking in rankings:
        for rank, key in enumerate(ranking):
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=scores.get, reverse=True)
