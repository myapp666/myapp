---
title: 竞争情报监控系统 实现计划（SSOT）
status: draft
date: 2026-07-08
spec: 001-competitor-tracking
version: 2.0
---

> **必需技能：** `spec-execute`（按批次执行本计划）
> **上下文获取：** 必须先执行 `spec-context` 获取上下文，定位 `{FEATURE_DIR}`，失败即停止

**目标：** 交付 JWT 用户系统 + MySQL 存储 + Python FastAPI 后端 + Next.js 14 前端的竞争情报监控 MVP

**范围：**
- **In：** 用户注册/登录（JWT）+ 竞对 CRUD（前端）+ 定时采集（APScheduler）+ AI 解读（Claude Haiku）+ 历史记录查看
- **Out：** 忘记密码/邮件重置、第三方 OAuth、多角色权限、实时告警推送、社媒抓取

**架构：** FastAPI 后端（SQLAlchemy 2.x + MySQL），JWT 无状态鉴权（access token 24h + refresh token 7d），APScheduler 3.x 按竞对动态调度，Next.js 14 App Router 前端（Tailwind CSS，Vercel 部署）。关键约束：`pool_recycle=3600`、`pool_pre_ping=True`，APScheduler job 独立 Session，CORS `allow_credentials=True`，`JWT_SECRET` ≥ 64 字节 hex。

**验收口径：** V-001（AI 质量）、V-002（采集稳定性）、V-003（用户体验）、V-004（竞对可维护性）、V-005（快照存储已裁决为 SQLite，closed）、V-006（JWT secret 安全）、V-007（SQLite WAL 写入安全）；AC-L01～AC-L07、AC-001～AC-011（引自 `requirements/prd.md`）

**影响范围：**
- 竞争情报监控系统（新建）
- myapp 前端（新增 `/login`、`/register`、`/monitor/competitors`、`/monitor` 页面）
- Python 后端（新建 SQLAlchemy 数据层，替换原 raw sqlite3 + JSON 文件方案）
- 用户账号与竞对配置存储（新建 MySQL 数据库，通过 `DATABASE_URL` env var 配置）

**需遵守的不变量：**
1. **数据隐私**：竞对信息与历史记录按 `user_id` 隔离；REST API 所有 `/api/*` 查询必须按当前登录用户的 `user_id` 过滤
2. **密码安全**：密码只存 bcrypt hash（factor 12），不落盘明文，不出现在日志
3. **无状态鉴权**：后端不维护会话存储，鉴权状态完全由 JWT 承载，兼容 Vercel 前端 + 独立后端部署

**子仓范围：** 无（3 + JSON filelock，无用户系统）完整重建为 v2（SQLAlchemy 2.x + SQLite WAL + JWT 用户系统 + Next.js 14 多页应用）。前端从单页原型升级为四页应用（登录/注册/竞对管理/监控记录）；后端从全局配置驱动改为按用户隔离的动态调度。

---

## 范围与边界

| 类型 | 内容 |
|---|---|
| In | 用户注册/登录（JWT access+refresh）、竞对 CRUD、定时采集、AI 解读、历史记录查看 |
| Out | 忘记密码、OAuth、多角色、实时告警、社媒抓取、数据迁移脚本 |
|rs /monitor） | 复用 Next.js 技术栈 |
| Python 后端 | 全量重建（SQLAlchemy + JWT 替换 raw sqlite3 + JSON） | scraper.py + raw sqlite3 + JSON 文件 → SQLAlchemy + SQLite WAL | 按 user_id 隔离；快照存入 snapshots 表 |

### 需遵守的不变量（引自 `requirements/solution.md §7.2`）

1. 数据隐私：`/api/competitors`、`/api/snapshots`、`/api/urls` 所有查询必须携带 `user_id` 过滤
2. 密码安全：`passlib[bcrypt]` + `rounds=12`；注册/登录日志不输出密码字段
3. 无状态鉴权：不引入 Redis/内存 session；所有受保护路由通过 `Depends(get_current_user)` 注入

### 跨模块协调（引自 `requirements/solution.md §7.3`）

- scheduler.py 从"读 `.env` MONITOR_URLS"改为"启动时 + CRUD 事件时查询 competitors 表"
- 前端所有 `/api/*` 调用通过 httpOnly cookie 携带 token（FastAPI 登录接口 `Set-Cookie`，前端无需手动传 header）
- `GET /api/urls` 接口必须保留（prd.md AC-L04 验收要求），返回当前用户的竞对 URL 列表

---

## 里程碑与节奏

| 里程碑 | 任务 | 交付物 |
|---|---|---|
| M1：后端基础层 | T1、T2、T3 | requirements.txt、.env.example、database.py、auth.py |
| M2：后端业务层 | T4、T5（保留）、T6、T7、T8 | storage.py（ORM）、api.py、scheduler.py、main.py |
| M3：前端 | T9、T10 | frontend/ Next.js 应用、vercel.json |
| M4：收尾与验证 | T11、T12 | .gitignore、验证通过 |

---

## 依赖与资源

- `AI_API_KEY`：Anthropic API Key（llm.py 沿用，已在上一轮实现中验证可用）
- `JWT_SECRET`：须由开发者执行 `python -c "import secrets; print(secrets.token_hex(64))"` 生成并写入 `.env`
- `ALLOWED_ORIGINS`：前端域名（本地开发 `http://localhost:3000`；生产为 Vercel 域名）
- Node.js 20+ 与 npm/pnpm（前端依赖）
- Python 3.11+（后端依赖）

---

## 风险与验证

| 风险 | 缓解 | Owner |
|---|---|---|
| MySQL 连接耗尽 | `pool_size=10`, `max_overflow=20`, `pool_recycle=3600`, `pool_pre_ping=True` | 开发 |
| httpOnly cookie 跨域 | CORS `allow_credentials=True` + `SameSite=None; Secure`（生产）/ `SameSite=Lax`（本地）| 开发 |
| bcrypt 72 字节截断 | 前端密码输入 maxlength=72，后端校验 len(password) ≤ 72 | 开发 |
| 目标网站反爬 | tenacity 重试 + UA 轮换 + 域级延迟 10-30s（已在 scraper.py 实现，commit 97f6b24）| 开发 |

---

## 验收口径（可追溯）

- 追溯：`requirements/prd.md §AC-L01～AC-L07`（登录注册 7 条）
- 追溯：`requirements/prd.md §AC-001～AC-011`（竞对/快照/监控 11 条）
- 追溯：`requirements/solution.md §5 V-001～V-006`（6 条验证项）
- 追溯：`design/design.md §V-007`（存储写入安全验证，已改为 MySQL）

---

## NEEDS CLARIFICATION

无阻断项。所有关键决策已在 `requirements/raw.md` 第 8-13 轮澄清中固化，设计侧 V-005/T10/T11 研究已完成并写入 `design/research.md`。

---

## 任务清单（SSOT）

> 唯一执行清单与状态来源：用 `- [ ] / - [x]` 标记完成。
> 命令默认面向 PowerShell；同一行多命令请用 `;` 分隔（不要用 `&&`）。

---

### Task T1：更新 requirements.txt 与 .env.example（v2 依赖）

- [ ] **状态**：未开始

**背景：** v1 已完成 `requirements.txt`（commit 69e158a）。v2 需新增 `sqlalchemy>=2.0.0`、`pymysql>=1.1.0`、`cryptography>=42.0.0`、`python-jose[cryptography]>=3.3.0`、`passlib[bcrypt]>=1.7.4`、`bcrypt==4.2.1`，移除 `filelock>=3.14.0`（JSON 存储废弃）；`.env.example` 需替换 `SECRET_KEY` 为 `JWT_SECRET`，移除 `MONITOR_URLS`，新增 `JWT_SECRET` 与 `DATABASE_URL`（MySQL 连接串）。

**代码仓范围：** 根项目

**文件：**
- 修改：`backend/requirements.txt`
- 修改（重建）：`backend/.env.example`
