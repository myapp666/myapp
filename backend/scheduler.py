import hashlib
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from tenacity import retry, stop_after_attempt, wait_exponential

from database import SessionLocal, Competitor
from llm import analyze_change
from scraper import diff_html, fetch_html
from storage import get_latest_html, save_snapshot

logger = logging.getLogger(__name__)

MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "60"))

_scheduler: BackgroundScheduler | None = None


def _job_id(competitor_id: int) -> str:
    return f"crawl_{competitor_id}"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))
def _fetch_with_retry(url: str) -> str:
    return fetch_html(url)


def _crawl_competitor(competitor_id: int) -> None:
    db = SessionLocal()
    try:
        competitor = db.get(Competitor, competitor_id)
        if not competitor:
            logger.warning("竞对 id=%d 不存在，跳过", competitor_id)
            return
        url = competitor.website_url
        user_id = competitor.user_id
    finally:
        db.close()

    try:
        new_html = _fetch_with_retry(url)
    except Exception as e:
        logger.error("采集失败 competitor_id=%d url=%s error=%s", competitor_id, url, e)
        return

    old_html = get_latest_html(competitor_id) or ""
    diff = diff_html(old_html, new_html)
    if not diff:
        logger.debug("无变化 competitor_id=%d url=%s", competitor_id, url)
        return

    analysis = analyze_change(url, diff)
    save_snapshot(
        competitor_id=competitor_id,
        user_id=user_id,
        html_content=new_html,
        change_type=analysis.get("change_type", ""),
        summary=analysis.get("summary", ""),
        importance=analysis.get("importance", ""),
    )
    logger.info("已保存变更 competitor_id=%d change_type=%s", competitor_id, analysis.get("change_type"))


def setup_scheduler() -> BackgroundScheduler:
    global _scheduler
    _scheduler = BackgroundScheduler()

    db = SessionLocal()
    try:
        competitors = db.query(Competitor).all()
        for c in competitors:
            _scheduler.add_job(
                _crawl_competitor,
                trigger=IntervalTrigger(minutes=MONITOR_INTERVAL),
                args=[c.id],
                id=_job_id(c.id),
                max_instances=1,
                replace_existing=True,
            )
            logger.info("已注册监控任务 competitor_id=%d url=%s", c.id, c.website_url)
    finally:
        db.close()

    return _scheduler


def add_competitor_job(competitor_id: int) -> None:
    if _scheduler is None:
        return
    _scheduler.add_job(
        _crawl_competitor,
        trigger=IntervalTrigger(minutes=MONITOR_INTERVAL),
        args=[competitor_id],
        id=_job_id(competitor_id),
        max_instances=1,
        replace_existing=True,
    )
    logger.info("动态添加监控任务 competitor_id=%d", competitor_id)


def remove_competitor_job(competitor_id: int) -> None:
    if _scheduler is None:
        return
    job_id = _job_id(competitor_id)
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
        logger.info("移除监控任务 competitor_id=%d", competitor_id)
