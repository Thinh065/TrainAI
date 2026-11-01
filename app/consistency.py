"""Kiểm tra một bài (slide, tài liệu) có nói trước sau như một không."""

import re
from typing import Any, Dict, List

from app.chatbot import ask_chatbot_json

MAX_DOCUMENT_CHARS = 300_000
SEVERITY_PENALTY = {"high": 15, "medium": 7, "low": 3}

PROMPT = """Bạn là người biên tập, đang soát một bài thuyết trình hoặc tài liệu do NHIỀU NGƯỜI cùng viết.
Nhiệm vụ: tìm những chỗ bài KHÔNG NHẤT QUÁN với chính nó. Đọc hết bài trước, rồi so các phần với nhau.

Tìm các loại sau:
- Mâu thuẫn số liệu: cùng một chỉ số, mốc thời gian, giá, tỉ lệ nhưng ghi khác nhau ở hai chỗ.
- Mâu thuẫn nhận định: phần trước đánh giá A (ví dụ "mức độ cao", "điểm mạnh"), phần sau lại nói ngược lại hoặc dùng mức khác.
- Phân tích và kết luận không khớp: giải pháp, đề xuất, kết luận không dựa trên (hoặc trái với) phần phân tích trước đó.
- Không thống nhất cách gọi: tên thương hiệu, sản phẩm, đối tượng khách hàng, thuật ngữ được gọi khác nhau theo cách gây hiểu nhầm.

KHÔNG báo:
- Lỗi chính tả, câu cú, định dạng, trừ khi làm đổi nghĩa.
- Chỗ chỉ nói thêm chi tiết mà không trái ngược.
- Điều bạn tự biết bên ngoài bài: chỉ so bài với chính nó.

Quy tắc bắt buộc:
- Mỗi vấn đề phải trích NGUYÊN VĂN câu chữ trong bài (copy chính xác, tối đa khoảng 200 ký tự) và ghi đúng nhãn vị trí, ví dụ "Slide 12".
- Mâu thuẫn thì phải có ít nhất 2 vị trí.
- Không bịa. Không chắc thì bỏ qua. Bài nhất quán thì trả "issues": [].
- severity: "high" nếu người nghe sẽ thấy bài tự mâu thuẫn ở ý chính; "medium" nếu lệch rõ nhưng ở ý phụ; "low" nếu chỉ gây khó hiểu.
- Viết toàn bộ bằng tiếng Việt.

Trả về JSON đúng dạng:
{{
  "summary": "2-3 câu nhận xét chung về độ nhất quán của bài",
  "issues": [
    {{
      "severity": "high | medium | low",
      "category": "Mâu thuẫn số liệu | Mâu thuẫn nhận định | Phân tích và kết luận không khớp | Không thống nhất cách gọi",
      "title": "Tóm tắt vấn đề trong một câu ngắn",
      "explanation": "Vì sao hai chỗ này không khớp",
      "locations": [{{"label": "Slide 3", "quote": "câu chữ nguyên văn"}}],
      "suggestion": "Nên sửa thống nhất thế nào"
    }}
  ],
  "consistent_points": ["Tối đa 3 điểm bài đã giữ thống nhất tốt"]
}}

Bài: {title}

{content}
"""


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _quote_found(quote: str, section_text: str) -> bool:
    """Trích dẫn có thật trong bài không: khớp nguyên văn, hoặc ít nhất 70% số chữ."""
    quote_n, text_n = _normalize(quote), _normalize(section_text)
    if not quote_n:
        return False
    if quote_n in text_n:
        return True
    words = re.findall(r"\w+", quote_n)
    text_words = set(re.findall(r"\w+", text_n))
    return bool(words) and sum(w in text_words for w in words) / len(words) >= 0.7


def _clean_issues(raw_issues: Any, sections: Dict[str, str]) -> List[Dict[str, Any]]:
    issues = []
    for raw in raw_issues if isinstance(raw_issues, list) else []:
        if not isinstance(raw, dict):
            continue
        locations = []
        for loc in raw.get("locations") or []:
            if not isinstance(loc, dict):
                continue
            label = str(loc.get("label", "")).strip()
            quote = str(loc.get("quote", "")).strip()
            if label in sections and _quote_found(quote, sections[label]):
                locations.append({"label": label, "quote": quote})
        # Một vấn đề không trích được chỗ nào có thật thì coi là model tự nghĩ ra.
        if not locations:
            continue
        severity = raw.get("severity") if raw.get("severity") in SEVERITY_PENALTY else "medium"
        issues.append(
            {
                "severity": severity,
                "category": str(raw.get("category") or "Không nhất quán"),
                "title": str(raw.get("title") or "").strip(),
                "explanation": str(raw.get("explanation") or "").strip(),
                "locations": locations,
                "suggestion": str(raw.get("suggestion") or "").strip(),
            }
        )
    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(issues, key=lambda i: order[i["severity"]])


def score_from_issues(issues: List[Dict[str, Any]]) -> int:
    """Điểm tính từ danh sách vấn đề, không để model tự cho điểm."""
    return max(0, 100 - sum(SEVERITY_PENALTY[i["severity"]] for i in issues))


def check_consistency(document: Dict[str, Any]) -> Dict[str, Any]:
    sections = {s["label"]: s["text"] for s in document["sections"]}
    content = "\n\n".join(f"### {label}\n{text}" for label, text in sections.items())
    truncated = len(content) > MAX_DOCUMENT_CHARS
    content = content[:MAX_DOCUMENT_CHARS]

    result = ask_chatbot_json(PROMPT.format(title=document.get("title", ""), content=content))
    if not isinstance(result, dict):
        result = {}
    issues = _clean_issues(result.get("issues"), sections)
    points = result.get("consistent_points")

    return {
        "title": document.get("title", ""),
        "source": document.get("source", ""),
        "total_sections": document.get("total_sections", len(sections)),
        "sections_with_text": len(sections),
        "truncated": truncated,
        "score": score_from_issues(issues),
        "summary": str(result.get("summary") or "").strip(),
        "issues": issues,
        "consistent_points": [str(p) for p in points][:3] if isinstance(points, list) else [],
    }
