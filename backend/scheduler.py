import logging
import os
import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from tenacity import retry, stop_after_attempt, wait_exponential

from database import get_conn
from llm import analyze_change
from scraper import diff_html, fetch_html
from storage import get_records, save_record

logger = logging.getLogger(__name__)

MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "60"))

_scheduler: BackgroundScheduler | None = None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))
def _fetch_with_retry(url: str) -> str:
    return fetch_html(url)


def _crawl_url(url: str) -> None:
    try:
        new_html = _fetch_with_retry(url)
    except Exception as e:
        logger.error("采集失败 url=%s error=%s", url, e)
        return

    existing = get_records(url, limit=1)
    old_html = existing[0]["html_content"] if existing else ""

    diff = diff_html(old_html, new_html)
    if not diff:
        logger.debug("无变化 url=%s", url)
        return

    analysis = analyze_change(url, diff)
    record = {
        "id": uuid.uuid4().hex,
        "url": url,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "html_content": new_html,
        "change_type": analysis.get("change_type", ""),
        "summary": analysis.get("summary", ""),
        "importance": analysis.get("importance", ""),
    }
    save_record(url, record)
    logger.info("已保存变更 url=%s change_type=%s", url, record["change_type"])


def _job_id(url: str) -> str:
    import hashlib
    return "crawl_" + hashlib.md5(url.encode()).hexdigest()[:16]


def setup_scheduler() -> BackgroundScheduler:
    global _scheduler
    _scheduler = BackgroundScheduler()

    with get_conn() as conn:
        rows = conn.execute("SELECT url FROM websites").fetchall()

    for row in rows:
        url = row["url"]
        _scheduler.add_job(
            _crawl_url,
            trigger=IntervalTrigger(minutes=MONITOR_INTERVAL),
            args=[url],
            id=_job_id(url),
            max_instances=1,
            replace_existing=True,
        )
        logger.info("已注册监控任务 url=%s interval=%dm", url, MONITOR_INTERVAL)

    return _scheduler


def add_website_job(url: str) -> None:
    if _scheduler is None:
        return
    _scheduler.add_job(
        _crawl_url,
        trigger=IntervalTrigger(minutes=MONITOR_INTERVAL),
        args=[url],
        id=_job_id(url),
        max_instances=1,
        replace_existing=True,
    )
    logger.info("动态添加监控任务 url=%s", url)


def remove_website_job(url: str) -> None:
    if _scheduler is None:
        return
    job_id = _job_id(url)
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
        logger.info("移除监控任务 url=%s", url)
