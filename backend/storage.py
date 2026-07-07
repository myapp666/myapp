import hashlib
import json
import os
from pathlib import Path
from filelock import FileLock

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def _url_to_slug(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:16]


def _data_path(url: str) -> Path:
    return DATA_DIR / f"{_url_to_slug(url)}.json"


def _lock_path(url: str) -> Path:
    return DATA_DIR / f"{_url_to_slug(url)}.json.lock"


def save_record(url: str, record: dict) -> None:
    path = _data_path(url)
    lock = FileLock(str(_lock_path(url)), timeout=10)
    with lock:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
        else:
            data = {"url": url, "records": []}
        data["records"].append(record)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_records(url: str, limit: int = 20) -> list:
    path = _data_path(url)
    if not path.exists():
        return []
    lock = FileLock(str(_lock_path(url)), timeout=10)
    with lock:
        data = json.loads(path.read_text(encoding="utf-8"))
    records = sorted(data.get("records", []), key=lambda r: r.get("crawled_at", ""), reverse=True)
    return records[:limit]


def get_urls() -> list:
    urls = []
    for p in DATA_DIR.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if "url" in data:
                urls.append(data["url"])
        except Exception:
            continue
    return urls


def get_record_by_id(record_id: str) -> dict | None:
    for p in DATA_DIR.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            for r in data.get("records", []):
                if r.get("id") == record_id:
                    return r
        except Exception:
            continue
    return None
