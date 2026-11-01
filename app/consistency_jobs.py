"""Chạy kiểm tra độ nhất quán ở nền: một bài dài có thể mất vài phút."""

import hashlib
import json
import logging
import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, Optional

import requests

from app.chatbot import ChatbotError
from app.consistency import check_consistency
from app.link_reader import LinkReadError, read_link

logger = logging.getLogger(__name__)

_JOB_TTL_SECONDS = 2 * 60 * 60
_CACHE_SIZE = 30

_jobs: Dict[str, Dict[str, Any]] = {}
# Cùng một nội dung thì không hỏi Gemini lại (tiết kiệm lượt miễn phí).
_results_by_content: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
_lock = threading.Lock()


def _content_key(document: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(document["sections"], ensure_ascii=False).encode("utf-8")).hexdigest()


def _update(job_id: str, **fields: Any) -> None:
    with _lock:
        _jobs[job_id].update(fields, updated_at=time.time())


def _run(job_id: str, url: str) -> None:
    try:
        document = read_link(url)
        _update(job_id, stage="checking", sections=len(document["sections"]), title=document.get("title", ""))

        key = _content_key(document)
        with _lock:
            cached = _results_by_content.get(key)
        result = cached or check_consistency(document)
        with _lock:
            _results_by_content[key] = result
            _results_by_content.move_to_end(key)
            while len(_results_by_content) > _CACHE_SIZE:
                _results_by_content.popitem(last=False)

        _update(job_id, status="done", stage="done", result={**result, "url": url})
    except LinkReadError as exc:
        _update(job_id, status="error", error=str(exc))
    except requests.RequestException as exc:
        logger.warning("Could not fetch %s: %s", url, exc)
        _update(job_id, status="error", error="Không tải được link. Kiểm tra lại link hoặc thử lại sau.")
    except ChatbotError as exc:
        _update(job_id, status="error", error=str(exc))
    except Exception as exc:  # pragma: no cover - unexpected failure is still reported to the user
        logger.exception("Consistency job failed")
        _update(job_id, status="error", error=f"Lỗi không mong muốn: {exc}")


def _forget_old_jobs() -> None:
    cutoff = time.time() - _JOB_TTL_SECONDS
    with _lock:
        for job_id in [j for j, job in _jobs.items() if job["updated_at"] < cutoff]:
            del _jobs[job_id]


def start_job(url: str, owner: str) -> str:
    _forget_old_jobs()
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = {"status": "running", "stage": "reading", "owner": owner, "updated_at": time.time()}
    threading.Thread(target=_run, args=(job_id, url), daemon=True).start()
    return job_id


def get_job(job_id: str, owner: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        if job is None or job["owner"] != owner:
            return None
        return {k: v for k, v in job.items() if k not in ("owner", "updated_at")}
