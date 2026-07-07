import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_conn
from storage import get_record_by_id, get_records

app = FastAPI(title="竞品监控 API")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 认证路由 ──────────────────────────────────────────────

class RegisterIn(BaseModel):
    username: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


@app.post("/auth/register", status_code=201)
def register(body: RegisterIn):
    now = datetime.now(timezone.utc).isoformat()
    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (username, email, password_hash, created_at) VALUES (?,?,?,?)",
                (body.username, body.email, hash_password(body.password), now),
            )
            user_id = cur.lastrowid
    except Exception:
        raise HTTPException(status_code=409, detail="用户名或邮箱已存在")
    return {"id": user_id, "username": body.username, "email": body.email}


@app.post("/auth/login")
def login(body: LoginIn):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (body.email,)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    token = create_access_token(row["id"], row["username"])
    return {"access_token": token, "token_type": "bearer"}


# ── 网站管理路由 ──────────────────────────────────────────

class WebsiteIn(BaseModel):
    url: str


@app.get("/api/websites")
def list_websites(current_user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM websites ORDER BY created_at DESC").fetchall()
    return {"websites": [dict(r) for r in rows]}


@app.post("/api/websites", status_code=201)
def add_website(body: WebsiteIn, current_user: dict = Depends(get_current_user)):
    from scheduler import add_website_job

    url = body.url.strip().rstrip("/")
    now = datetime.now(timezone.utc).isoformat()
    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO websites (url, name, added_by, created_at) VALUES (?,?,?,?)",
                (url, None, current_user["id"], now),
            )
            website_id = cur.lastrowid
    except Exception:
        raise HTTPException(status_code=409, detail="该网站已在监控列表中")

    add_website_job(url)
    return {"id": website_id, "url": url, "name": None, "created_at": now}


@app.delete("/api/websites/{website_id}", status_code=204)
def delete_website(website_id: int, current_user: dict = Depends(get_current_user)):
    from scheduler import remove_website_job

    with get_conn() as conn:
        row = conn.execute("SELECT url FROM websites WHERE id = ?", (website_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="网站不存在")
        conn.execute("DELETE FROM websites WHERE id = ?", (website_id,))

    remove_website_job(row["url"])


# ── 快照查询路由 ──────────────────────────────────────────

@app.get("/api/snapshots")
def list_snapshots(
    url: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    items = get_records(url, limit=limit)
    return {"items": items, "total": len(items)}


@app.get("/api/snapshots/{record_id}")
def get_snapshot(record_id: str, current_user: dict = Depends(get_current_user)):
    record = get_record_by_id(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record
