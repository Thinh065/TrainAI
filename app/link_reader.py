"""Đọc nội dung từ một link public: Canva, Google Slides/Docs, file .docx/.pptx/.pdf."""

import io
import ipaddress
import json
import re
import socket
import tempfile
import os
from html import unescape
from typing import Any, Dict, List
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import requests

from app.pdf_processor import extract_text_from_pdf

MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024
TIMEOUT_SECONDS = 30
_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


class LinkReadError(ValueError):
    """Link không đọc được; message nói rõ cho người dùng cách xử lý."""


# ---------------------------------------------------------------- tải an toàn


def _check_public_host(url: str) -> None:
    """Chặn link trỏ vào máy nội bộ (localhost, mạng LAN, metadata cloud)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise LinkReadError("Link phải bắt đầu bằng http:// hoặc https://")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise LinkReadError(f"Không tìm thấy trang {parsed.hostname}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise LinkReadError("Chỉ đọc được link public trên Internet")


def _download(url: str) -> requests.Response:
    """GET theo từng bước chuyển hướng, kiểm tra host ở mỗi bước, giới hạn dung lượng."""
    session = requests.Session()
    for _ in range(6):
        _check_public_host(url)
        response = session.get(
            url,
            headers={"User-Agent": _BROWSER_UA, "Accept-Language": "vi,en;q=0.8"},
            timeout=TIMEOUT_SECONDS,
            allow_redirects=False,
            stream=True,
        )
        if response.is_redirect:
            url = requests.compat.urljoin(url, response.headers["Location"])
            continue
        if response.status_code in (401, 403):
            raise LinkReadError("Link chưa để public. Hãy bật chia sẻ “Bất kỳ ai có đường liên kết”.")
        if response.status_code == 404:
            raise LinkReadError("Không tìm thấy tài liệu ở link này")
        if response.status_code >= 400:
            raise LinkReadError(f"Trang trả về lỗi {response.status_code}")

        body = bytearray()
        for part in response.iter_content(64 * 1024):
            body.extend(part)
            if len(body) > MAX_DOWNLOAD_BYTES:
                raise LinkReadError("Tài liệu lớn hơn 25 MB")
        response._content = bytes(body)
        response.final_url = url
        return response
    raise LinkReadError("Link chuyển hướng quá nhiều lần")


# ---------------------------------------------------------------- từng nguồn


def _section(label: str, text: str) -> Dict[str, str]:
    return {"label": label, "text": re.sub(r"[ \t]+", " ", text).strip()}


def _js_string(raw: str) -> str:
    escapes = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}

    def replace(match: "re.Match[str]") -> str:
        code = match.group(1)
        if code[0] in "ux" and len(code) > 1:
            return chr(int(code[1:], 16))
        return escapes.get(code, code)

    return re.sub(r"\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)", replace, raw, flags=re.S)


def _canva_texts(node: Any, out: List[str]) -> None:
    """Chữ trong một phần tử Canva: ô chữ ở a.C.A (danh sách đoạn), ô bảng ở {"A?":"A","A":...}."""
    if isinstance(node, dict):
        if node.get("A?") == "A" and isinstance(node.get("A"), str):
            out.append(node["A"])
            return
        content = node.get("a")
        content = content.get("C") if isinstance(content, dict) else None
        paragraphs = content.get("A") if isinstance(content, dict) else None
        if isinstance(paragraphs, list) and paragraphs and all(isinstance(p, str) for p in paragraphs):
            out.append("".join(paragraphs))
        for key, value in node.items():
            if key != "a":
                _canva_texts(value, out)
    elif isinstance(node, list):
        for value in node:
            _canva_texts(value, out)


def read_canva(url: str) -> Dict[str, Any]:
    match = re.search(r"canva\.com/design/([\w-]+)/([\w-]+)", url)
    if not match:
        raise LinkReadError("Link Canva phải có dạng canva.com/design/…/…")
    view_url = f"https://www.canva.com/design/{match.group(1)}/{match.group(2)}/view"
    html = _download(view_url).text

    data_match = re.search(r"window\['bootstrap'\] = JSON\.parse\('((?:[^'\\]|\\.)*)'\)", html, re.S)
    if not data_match:
        raise LinkReadError("Không đọc được bài Canva. Hãy bật “Bất kỳ ai có đường liên kết đều có thể xem”.")
    try:
        data = json.loads(_js_string(data_match.group(1)))
        pages = data["page"]["Pm"]["E"]["draft"]["content"]["A"]
    except (ValueError, KeyError, TypeError) as exc:
        # Canva đổi cấu trúc trang: đường dự phòng là tải PDF.
        raise LinkReadError("Canva vừa đổi cách hiển thị nên chưa đọc được. Hãy tải bài về dạng PDF rồi kéo vào app.") from exc

    sections = []
    for number, page in enumerate(pages, 1):
        texts: List[str] = []
        _canva_texts(page.get("E", []), texts)
        # ${pageNumberOnly} and the like are Canva placeholders, not slide text.
        text = "\n".join(t.strip() for t in (re.sub(r"\$\{\w+\}", "", t) for t in texts) if t.strip())
        if text:
            sections.append(_section(f"Slide {number}", text))

    title_match = re.search(r"<title>(.*?)</title>", html, re.S)
    return {
        "title": unescape(title_match.group(1)).strip() if title_match else "Bài Canva",
        "source": "Canva",
        "total_sections": len(pages),
        "sections": sections,
    }


def _read_pptx(data: bytes) -> List[Dict[str, str]]:
    from pptx import Presentation

    sections = []
    for number, slide in enumerate(Presentation(io.BytesIO(data)).slides, 1):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                texts.append(shape.text_frame.text)
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    texts.append(" | ".join(cell.text for cell in row.cells))
        notes = slide.notes_slide.notes_text_frame.text if slide.has_notes_slide else ""
        if notes.strip():
            texts.append(f"(Ghi chú người nói) {notes}")
        text = "\n".join(t.strip() for t in texts if t.strip())
        if text:
            sections.append(_section(f"Slide {number}", text))
    return sections


def _read_docx(data: bytes) -> List[Dict[str, str]]:
    from docx import Document

    doc = Document(io.BytesIO(data))
    sections: List[Dict[str, str]] = []
    heading, lines = "Mở đầu", []

    def flush():
        if any(line.strip() for line in lines):
            sections.append(_section(heading, "\n".join(lines)))

    for paragraph in doc.paragraphs:
        if paragraph.style.name.lower().startswith(("heading", "title")) and paragraph.text.strip():
            flush()
            heading, lines = paragraph.text.strip()[:80], []
        else:
            lines.append(paragraph.text)
    flush()
    for number, table in enumerate(doc.tables, 1):
        rows = [" | ".join(cell.text.strip() for cell in row.cells) for row in table.rows]
        sections.append(_section(f"Bảng {number}", "\n".join(rows)))
    return sections


def _read_pdf(data: bytes) -> List[Dict[str, str]]:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
        handle.write(data)
        path = handle.name
    try:
        return [_section(f"Trang {p['page_number']}", p["raw_text"]) for p in extract_text_from_pdf(path)]
    finally:
        os.remove(path)


def _read_file_bytes(data: bytes, name_hint: str) -> List[Dict[str, str]]:
    if data.startswith(b"%PDF"):
        return _read_pdf(data)
    if data.startswith(b"PK"):
        if b"ppt/" in data[:4000] or name_hint.endswith(".pptx"):
            return _read_pptx(data)
        return _read_docx(data)
    raise LinkReadError("Link không trỏ tới file .docx, .pptx hay .pdf")


def read_google(url: str) -> Dict[str, Any]:
    match = re.search(r"docs\.google\.com/(presentation|document)/d/([\w-]+)", url)
    if not match:
        raise LinkReadError("Link Google phải là Google Slides hoặc Google Docs")
    kind, doc_id = match.groups()
    fmt = "pptx" if kind == "presentation" else "docx"
    export_url = f"https://docs.google.com/{kind}/d/{doc_id}/export?format={fmt}"
    response = _download(export_url)
    if not response.content.startswith(b"PK"):
        raise LinkReadError("Google chưa cho tải file. Hãy bật chia sẻ “Bất kỳ ai có đường liên kết”.")
    sections = _read_pptx(response.content) if fmt == "pptx" else _read_docx(response.content)
    return {
        "title": _filename(response) or ("Google Slides" if fmt == "pptx" else "Google Docs"),
        "source": "Google Slides" if fmt == "pptx" else "Google Docs",
        "total_sections": len(sections),
        "sections": sections,
    }


def _filename(response: requests.Response) -> str:
    disposition = response.headers.get("Content-Disposition", "")
    match = re.search(r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)", disposition)
    if not match:
        return ""
    name = requests.utils.unquote(match.group(1) or match.group(2))
    return re.sub(r"\.(pptx|docx|pdf)$", "", name, flags=re.I)


def _onedrive_download_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    query["download"] = ["1"]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def read_file_link(url: str) -> Dict[str, Any]:
    host = urlparse(url).hostname or ""
    if any(h in host for h in ("1drv.ms", "onedrive.live.com", "sharepoint.com")):
        url = _onedrive_download_url(url)
    response = _download(url)
    name = _filename(response) or os.path.basename(urlparse(response.final_url).path)
    sections = _read_file_bytes(response.content, name.lower())
    return {
        "title": name or "Tài liệu",
        "source": "File",
        "total_sections": len(sections),
        "sections": sections,
    }


def read_link(url: str) -> Dict[str, Any]:
    url = (url or "").strip()
    host = urlparse(url).hostname or ""
    if host.endswith("canva.com"):
        result = read_canva(url)
    elif host == "docs.google.com":
        result = read_google(url)
    else:
        result = read_file_link(url)

    if not result["sections"]:
        raise LinkReadError("Không thấy chữ nào trong tài liệu (có thể toàn là hình ảnh)")
    return result
