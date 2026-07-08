from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from database import SessionLocal, Snapshot


def save_snapshot(
    competitor_id: int,
    user_id: int,
    html_content: str,
    change_type: str,
    summary: str,
    importance: str,
) -> Snapshot:
    db: Session = SessionLocal()
    try:
        snap = Snapshot(
            competitor_id=competitor_id,
            user_id=user_id,
            crawled_at=datetime.now(timezone.utc),
            html_content=html_content,
            change_type=change_type,
            summary=summary,
            importance=importance,
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)
        return snap
    finally:
        db.close()


def get_latest_html(competitor_id: int) -> Optional[str]:
    db: Session = SessionLocal()
    try:
        snap = (
            db.query(Snapshot)
            .filter(Snapshot.competitor_id == competitor_id)
            .order_by(Snapshot.crawled_at.desc())
            .first()
        )
        return snap.html_content if snap else None
    finally:
        db.close()


def get_snapshots(user_id: int, competitor_id: int, limit: int = 20) -> list[dict]:
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(Snapshot)
            .filter(Snapshot.user_id == user_id, Snapshot.competitor_id == competitor_id)
            .order_by(Snapshot.crawled_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "competitor_id": r.competitor_id,
                "crawled_at": r.crawled_at.isoformat(),
                "change_type": r.change_type,
                "summary": r.summary,
                "importance": r.importance,
            }
            for r in rows
        ]
    finally:
        db.close()


def get_snapshot_by_id(snapshot_id: int, user_id: int) -> Optional[dict]:
    db: Session = SessionLocal()
    try:
        snap = (
            db.query(Snapshot)
            .filter(Snapshot.id == snapshot_id, Snapshot.user_id == user_id)
            .first()
        )
        if not snap:
            return None
        return {
            "id": snap.id,
            "competitor_id": snap.competitor_id,
            "crawled_at": snap.crawled_at.isoformat(),
            "html_content": snap.html_content,
            "change_type": snap.change_type,
            "summary": snap.summary,
            "importance": snap.importance,
        }
    finally:
        db.close()
