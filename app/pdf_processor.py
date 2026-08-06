import hashlib
import re
from typing import Dict, List

from pypdf import PdfReader


def compute_file_id(pdf_path: str) -> str:
    """Compute a stable identifier for a PDF file using its content hash."""
    hash_sha256 = hashlib.sha256()
    with open(pdf_path, "rb") as stream:
        for chunk in iter(lambda: stream.read(8192), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


def _normalize_text(raw_text: str) -> str:
    if raw_text is None:
        return ""

    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r" +", " ", text)
    return text.strip()


def _convert_table_like_text(normalized_text: str) -> str:
    lines = [line.rstrip() for line in normalized_text.splitlines() if line.strip()]
    if len(lines) < 3:
        return normalized_text

    table_lines = [line for line in lines if "|" in line or re.search(r"\s{2,}", line)]
    if len(table_lines) < max(3, len(lines) // 2):
        return normalized_text

    rows: List[List[str]] = []
    for line in table_lines:
        if "|" in line:
            cells = [cell.strip() for cell in line.split("|") if cell.strip() != ""]
        else:
            cells = [cell.strip() for cell in re.split(r"\s{2,}", line) if cell.strip() != ""]
        if cells:
            rows.append(cells)

    if len(rows) < 2:
        return normalized_text

    max_cols = max(len(row) for row in rows)
    if max_cols < 2:
        return normalized_text

    normalized_rows = [row + [""] * (max_cols - len(row)) for row in rows]
    header = normalized_rows[0]
    separator = ["---" for _ in header]
    markdown_lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(separator) + " |"]
    for row in normalized_rows[1:]:
        markdown_lines.append("| " + " | ".join(row) + " |")

    return "\n".join(markdown_lines)


def extract_text_from_pdf(pdf_path: str) -> List[Dict[str, str]]:
    """Trích xuất văn bản từ file PDF, bảo toàn trang và cấu trúc bảng nếu có."""
    reader = PdfReader(pdf_path)
    pages: List[Dict[str, str]] = []

    for page_number, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        normalized_text = _normalize_text(raw_text)
        if not normalized_text:
            continue

        converted_text = _convert_table_like_text(normalized_text)
        pages.append({
            "page_number": page_number,
            "text": converted_text,
            "raw_text": normalized_text,
        })

    return pages


def _split_long_text(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    if len(text) <= chunk_size:
        return [text]

    sentences = re.split(r"(?<=\S[.!?])\s+", text)
    chunks: List[str] = []
    current_chunk = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(current_chunk) + len(sentence) + 1 <= chunk_size:
            current_chunk = f"{current_chunk} {sentence}".strip()
            continue

        if current_chunk:
            chunks.append(current_chunk)
            overlap_text = current_chunk[-chunk_overlap:] if chunk_overlap and len(current_chunk) > chunk_overlap else current_chunk
            current_chunk = f"{overlap_text} {sentence}".strip()
        else:
            if len(sentence) <= chunk_size:
                current_chunk = sentence
            else:
                start = 0
                while start < len(sentence):
                    end = min(start + chunk_size, len(sentence))
                    chunks.append(sentence[start:end].strip())
                    start += chunk_size - chunk_overlap
                current_chunk = ""

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def chunk_text(text: str, chunk_size: int = 700, chunk_overlap: int = 120) -> List[str]:
    """Chia văn bản thành các đoạn nhỏ hơn với overlap để không mất ngữ cảnh."""
    text = text.strip()
    if not text:
        return []

    paragraphs = [paragraph for paragraph in re.split(r"\n{2,}", text) if paragraph.strip()]
    chunks: List[str] = []

    for paragraph in paragraphs:
        if len(paragraph) <= chunk_size:
            if chunks and len(chunks[-1]) + len(paragraph) + 2 <= chunk_size:
                chunks[-1] = f"{chunks[-1]}\n\n{paragraph}".strip()
            else:
                chunks.append(paragraph)
            continue

        chunks.extend(_split_long_text(paragraph, chunk_size, chunk_overlap))

    return chunks