---
title: 竞争情报监控系统 - D1 设计调研
status: updated
date: 2026-07-07
last_updated: 2026-07-07
feature: competitor-tracking
spec: 001-competitor-tracking
---

## 基本信息

- Date：2026-07-07
- Last Updated：2026-07-07
- Feature：竞争情报监控系统（competitor-tracking）
- Spec（分支 / ID）：001-competitor-tracking

## TL;DR（最大风险 + 推荐方向）

- **最大风险**：目标网站反爬策略未知，采集稳定性无法提前保证（V-002）；JWT secret 若硬编码或强度不足，所有 token 立即作废（V-006）
- **推荐方向**：
  - 采集层：requests+BS4 主采集 + APScheduler 调度 + Playwright JS fallback
  - 存储层：**SQLite 统一存储**（用户账号 + 竞对配置 + 快照，含 user_id FK）+ WAL 模式并发安全；废弃 JSON 文件方案（V-005 关闭）
  - 鉴权层：JWT HS256（`secrets.token_hex(64)` 生成 secret）+ httpOnly cookie 存储（禁 localStorage）+ bcrypt factor 12
  - 通信层：FastAPI REST API；Vercel 前端通过 NEXT_PUBLIC_API_BASE_URL 调用后端
  - LLM：Claude Haiku 4.5，结构化 JSON 输出

---

## 未知项 → 研究任务映射表

| 未知项来源（solution.md Context Gaps / v3.0 新增） | 研究任务编号 |
|---|---|
| LLM 选型未确定 | T1 |
| 定时采集调度机制未定 | T2 |
| 目标网站反爬策略未知 | T3 |
| 数据库选型未定（v1 快照存储） | T4 |
| 前后端通信方式未定 | T5 |
| 现有 myapp 为纯静态页面，仓库结构未定 | T6 |
| JWT secret 生成方式与强度要求（V-006） | T7 |
| 前端 token 存储方式——httpOnly cookie vs localStorage XSS 风险（V-006） | T8 |
| bcrypt cost factor 选择——密码安全与性能权衡 | T9 |
| 快照存储方案裁决——SQLite（含 user_id FK）vs JSON 文件 + filelock（V-005） | T10 |
| SQLite 在 FastAPI + APScheduler 单进程中并发写安全性 | T11 |

---

## Research Tasks Completed

### T1. LLM 选型：HTML 变化语义解读

**Task**：确定用于解读网页内容变化的 LLM 模型与调用方式，支持从 HTML diff 中提取结构化竞品动态（产品更新、定价变化等）

**Decision**：使用 **claude-haiku-4-5** via Anthropic Python SDK，输出结构化 JSON（change_type / summary / importance）

**Rationale**：
- Haiku 4.5 成本最低（$1/1M input tokens），适合高频定时调用（每次 HTML diff 约 2-10K tokens）
- Anthropic SDK 原生支持结构化输出（`messages.parse()`），可直接约束 JSON schema，避免输出解析不稳定
- `.env` 中 `AI_API_KEY` 可直接对应 Anthropic API key，后续换模型只改环境变量，不改代码逻辑
- HTML 变化解读属于"分类+摘要"任务，不需要复杂推理，Haiku 能力足够

**Alternatives considered**：
- **claude-sonnet-4-6**：质量更高但 3× 成本，MVP 阶段 Haiku 足够；若 V-001 验证不达标可升级
- **OpenAI GPT-4o-mini**：价格相近，但需要额外 SDK，且 `.env` 中 `AI_API_KEY` 语义更适合单一提供商
- **本地开源模型（Ollama）**：零成本但需要本机 GPU，部署复杂度高，不适合 MVP

**Evidence**：
- Anthropic Haiku 4.5 定价：$1.00/1M input，$5.00/1M output（claude-api skill model table）
- Anthropic Python SDK 支持 `client.messages.parse()` 结构化输出
- solution.md 第 2 节：「单一 AI 接口：MVP 阶段只接入一个 LLM，不做多模型路由」

---

### T2. 定时任务调度：Python 后端调度机制

**Task**：查找 Python 定时采集任务的最佳实践，确定调度库选型与 max_instances 并发控制策略

**Decision**：使用 **APScheduler 3.x**，`IntervalTrigger`，`max_instances=1`，配合 **tenacity** 做指数退避重试

**Rationale**：
- APScheduler 是 Python 定时任务事实标准，支持 `IntervalTrigger` 直接对应 `MONITOR_INTERVAL` 环境变量
- `max_instances=1` 防止上一轮采集未完成时新轮触发，避免并发写入冲突
- tenacity 提供装饰器式重试（`@retry(wait=wait_exponential(...))`），网络异常时自动退避，不影响主调度循环
- 整体为进程内调度，不需要额外中间件（Celery/Redis），符合 MVP 最小复杂度

**Alternatives considered**：
- **Celery + Redis**：分布式任务队列，过度工程，MVP 单机运行无需此复杂度
- **cron（系统级）**：不在 Python 进程内，无法复用应用上下文和配置，且跨平台兼容性差
- **asyncio + asyncio.sleep 循环**：可行但错误处理复杂，APScheduler 已封装好

**Evidence**：
- APScheduler 文档：`IntervalTrigger(minutes=interval)` 配置；`max_instances` 参数防并发
- tenacity：`stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60)`

---

### T3. 网页采集策略：反爬应对与稳定性

**Task**：确定 HTML 采集技术栈与反爬应对策略，目标 >90% 采集成功率（V-002）

**Decision**：**requests + BeautifulSoup4** 为主采集层，**Playwright** 为 JS 渲染页面的 fallback；UA 轮换 + 域名级随机延迟（10-30s + jitter）

**Rationale**：
- 大多数竞品官网为静态或服务端渲染，requests+BS4 足够，轻量且无需浏览器驱动
- Playwright 仅在检测到 JS 渲染特征（空 body / 典型 SPA 标志）时触发，避免所有请求都走重型路径
- UA 轮换 + 延迟是最基础的礼貌爬取措施，降低被 rate-limit 的概率
- 域名级延迟控制（同一域名请求间隔），防止短时间高频触发 WAF

**Alternatives considered**：
- **Scrapy**：框架完整但配置复杂，MVP 只需简单 HTTP 请求，过度工程
- **纯 Playwright（所有请求走浏览器）**：稳定性高但资源消耗大，启动慢，不适合高频定时采集
- **第三方采集 API（ScraperAPI/Zyte）**：省去反爬处理，但月费较高且增加外部依赖

**触发动作**：若 V-002 不达标，引入代理池（rotating proxies）或降低 MONITOR_INTERVAL

**Evidence**：
- requests + BeautifulSoup 是 Python 爬虫入门标准组合，广泛用于静态页采集
- Playwright Python 官方文档：支持 headless 模式，适合 JS 渲染页面

---

### T4. 数据存储选型：历史记录存储与查询

**Task**：确定 MVP 存储选型，支持 Python APScheduler 写入历史快照 + FastAPI REST API 读取供前端查询

**Decision**：**JSON 文件 + filelock**；每个监控 URL 对应一个 `data/{url_slug}.json` 文件，内含 records 数组；`filelock` 保证并发写安全

**Rationale**：
- JSON 文件零依赖（无数据库进程、无驱动、无 schema 迁移工具），部署最简单
- MVP 数据量小（数十个 URL × 数百条记录），JSON 读写性能完全够用
- 每 URL 独立文件：写锁粒度小（仅锁单个文件），APScheduler `max_instances=1` 已保证同 URL 不并发写，filelock 作为额外安全兜底
- FastAPI 读取时直接加载 JSON，按 `crawled_at` 倒序，返回前 N 条；无需 ORM 或查询优化
- 回滚/备份极简：`cp data/ data_backup/` 即完成全量备份

**迁移阈值**（何时升级存储）：
- 单 URL 历史记录超过 **1 万条**，或
- 需要多实例部署（文件不可跨机器共享），或
- 需要全文检索 / 复杂聚合查询

**Alternatives considered**：
- **SQLite WAL + Alembic**：并发安全但引入额外依赖（sqlalchemy、alembic），schema 迁移增加复杂度；MVP 规模不需要
- **PostgreSQL**：生产级但需独立服务进程，MVP 部署复杂度不值
- **MongoDB**：文档型存储适合变化数据，但需要独立进程，过度工程

**Evidence**：
- `filelock` PyPI 库：跨平台文件锁，支持 `with FileLock(path)` 上下文管理
- JSON 文件结构示例：`{ "url": "...", "records": [{ "id", "crawled_at", "html_content", "change_type", "summary", "importance" }, ...] }`

---

### T5. 前后端通信方式：Python 后端 ↔ Node.js 前端

**Task**：确定 Python 后端（写）与 Node.js 前端（读）的通信/数据共享方式

**Decision**：**REST API**（Python 后端暴露 HTTP 接口，Vercel 前端通过环境变量调用）

> 原结论「共享 SQLite 文件」被 T6 Vercel 部署约束推翻：前端部署在 Vercel，无法访问后端本地文件系统，必须改用网络接口。

**Rationale**：
- Vercel 前端与 Python 后端运行在不同机器，文件共享不可行
- Python 后端新增 `api.py`（FastAPI 推荐：自带 OpenAPI 文档，async 支持好）
- 前端通过 `NEXT_PUBLIC_API_BASE_URL` 环境变量调用 REST 接口，本地/生产只改变量
- FastAPI 与 APScheduler 同进程运行：调度任务写 JSON 文件，API 路由读 JSON 文件，filelock 保证并发安全

**核心接口（最小集）**：
- `GET /api/snapshots?url={url}&limit=20` — 查询某 URL 的历史记录列表
- `GET /api/snapshots/{id}` — 查询单条记录详情（含 AI 解读）
- `GET /api/urls` — 返回当前 MONITOR_URLS 列表（前端下拉选择用）

**Alternatives considered**：
- **共享 SQLite 文件**：仅适用于同机部署；Vercel 部署后不可行
- **消息队列（Redis/RabbitMQ）**：过度工程，REST API 已满足查询需求
- **GraphQL**：查询灵活但前期搭建成本高，MVP REST 足够

---

### T6. 仓库结构与部署：Vercel + GitHub 集成

**Task**：确定现有纯静态 myapp（index.html/styles.css/script.js）如何扩展以容纳 Python 后端和 Node.js 前端，并支持通过 Vercel 从 GitHub 自动部署

**Decision**：**同一 GitHub 仓库，前端部署到 Vercel**，Python 后端独立运行（本地/VPS/云服务器）；前端通过 Vercel 环境变量指向后端 API；根目录保留现有 landing page

**关键约束（Vercel 决定）**：
- Vercel 不支持常驻 Python 进程（APScheduler 定时任务无法在 Vercel 上运行）
- Vercel 适合静态资源 + Serverless API（Node.js），不适合 Python 后端
- 因此 Python 采集服务必须独立部署（本地 / VPS / 云服务器），对外暴露 REST API
- 这意味着前后端通信方式从「共享 SQLite 文件」**变更为 REST API**（T5 结论需联动更新）

**Rationale**：
- Vercel 与 GitHub 原生集成：push 到 main 分支自动触发构建部署，无需额外 CI/CD 配置
- 前端（历史记录展示）天然适合 Vercel：Next.js/静态 + Serverless API 路由
- Python 后端（定时采集 + AI 解读）保持独立，不受 Vercel 函数超时（30s）限制
- SQLite 改为 Python 后端内部存储；前端通过后端 REST API 查询数据，不直接接触数据库

**目录结构**：
```
myapp/                        # GitHub 仓库根目录
├── index.html                # 现有 landing page（Vercel 直接服务）
├── styles.css
├── script.js
├── vercel.json               # 新增：Vercel 路由配置（将 /monitor 指向 frontend/）
├── backend/                  # Python 采集服务（不部署到 Vercel，独立运行）
│   ├── requirements.txt
│   ├── main.py               # APScheduler 入口
│   ├── scraper.py            # requests + Playwright
│   ├── llm.py                # Anthropic SDK 调用
│   ├── models.py             # SQLAlchemy models + REST API（FastAPI/Flask）
│   ├── api.py                # REST API 路由（供前端查询历史记录）
│   └── alembic/              # 数据库迁移
└── frontend/                 # Node.js/Next.js 历史记录展示（部署到 Vercel）
    ├── package.json
    ├── next.config.js        # 或 vite.config.js
    └── ...
```

**T5 联动修订（共享 SQLite → REST API）**：
- 前端无法直接读 SQLite（文件不在同机），改为调用后端 REST API
- 后端新增 `api.py`（FastAPI 或 Flask），暴露 `GET /api/snapshots?url=...&limit=20` 等接口
- Vercel 前端通过环境变量 `NEXT_PUBLIC_API_BASE_URL` 指向后端服务地址
- 本地开发：`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`；生产：指向 VPS/云服务器地址

**Alternatives considered**：
- **Python 后端也部署到 Vercel Serverless**：Vercel Python 函数不支持 APScheduler 常驻进程，定时任务无法运行，不可行
- **全部用 Vercel Cron Jobs 替代 APScheduler**：Vercel Cron 免费版 1次/天，频率不足；且 Python 支持有限
- **新建独立仓库（前后端分开）**：同仓 GitHub 管理更简单，Vercel 可通过 `Root Directory` 配置指定 frontend/ 子目录构建

**Evidence**：
- Vercel 部署文档：支持 `Root Directory` 设置，可将 `frontend/` 作为构建根目录
- Vercel 环境变量：在 Dashboard 配置 `NEXT_PUBLIC_API_BASE_URL`，自动注入到构建
- solution.md 第 7.1 节：「myapp 前端 → 扩展/新增页面；复用现有 Node.js 技术栈」

---

### T7. JWT secret 生成方式与强度要求

**Task**：确定 JWT_SECRET 的最小长度、生成方法与 `.env` 存储最佳实践，支持 FastAPI HS256 签名

**Decision**：使用 `secrets.token_hex(64)` 生成 128 hex 字符（512 bit）作为 JWT secret，存入 `.env`，绝不硬编码

**Rationale**：
- RFC 7518 §3.2 要求 HS256 key ≥ 256 bit（32 bytes）；64 bytes（512 bit）提供充足安全裕度
- `secrets.token_hex(64)` 使用 `os.urandom()`（CSPRNG），是 Python 标准库推荐方式
- FastAPI 官方文档使用 `openssl rand -hex 32`，本项目提高到 64 bytes 以对齐行业加固实践
- `.env` + `.gitignore` + `.env.example`（含占位符）是 FastAPI 生态最佳实践
- HS256 对称签名：secret 泄露即全部 token 作废，短 TTL（access 24h + refresh 7d）降低窗口期

**Alternatives considered**：
- `random.random()` / UUID4：不是 CSPRNG，不可用于密码学场景
- RS256 非对称算法：公私钥分离便于轮换，但 MVP 单服务无此需求，引入复杂度不值

**Evidence**：
- RFC 7518 Section 3.2：HMAC 密钥长度不得短于哈希输出（256 bit）
- FastAPI OAuth2+JWT 官方教程：fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- solution.md V-006：「JWT secret 通过 `.env` 管理且强度足够（≥32 字节随机串）」

---

### T8. 前端 token 存储：httpOnly cookie vs localStorage

**Task**：确定 Next.js（Vercel）前端存储 JWT access token 与 refresh token 的方式，规避 XSS 风险

**Decision**：使用 **httpOnly cookie**（`SameSite=Lax`、`Secure`）存储 token；不使用 localStorage

**Rationale**：
- OWASP HTML5 Security Cheat Sheet 明确禁止将会话凭证存储在 localStorage：任何 JavaScript（包括第三方脚本）均可读取
- httpOnly cookie 对 JS 完全不可见，XSS 无法窃取
- Vercel / Next.js App Router 原生支持 httpOnly cookie：API routes、Server Components、Middleware 均可通过 `cookies()` 读取，无 SSR 兼容问题
- Auth.js/NextAuth.js 默认即为 `httpOnly + Secure + SameSite=Lax`（行业标杆）
- 跨域场景（Vercel 前端 + 独立 FastAPI 后端）：FastAPI 侧设置 `Access-Control-Allow-Credentials: true`、`SameSite=None; Secure`；同域代理则 `SameSite=Lax` 足够

**Alternatives considered**：
- **localStorage + axios interceptor**：实现简单，但 XSS 全暴露；第三方脚本供应链攻击风险不可接受
- **内存存储（无持久化）**：XSS 安全但刷新页面后 token 丢失，UX 差，不适合内部工具

**Evidence**：
- OWASP HTML5 Security Cheat Sheet：cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
- Auth.js 默认 cookie 配置：next-auth.js.org/configuration/options#cookies
- Vercel 边缘网络 Cookie 支持：vercel.com/docs/edge-network/cookies
- solution.md V-006：「审查前端 token 存储方式（httpOnly cookie 或 localStorage + 防 XSS 措施）」

---

### T9. bcrypt cost factor：密码安全与性能权衡

**Task**：确定 passlib[bcrypt] 的 cost factor（rounds），满足 2026 年安全基线，适配低流量内部应用

**Decision**：使用 **cost factor 12**（passlib 默认值），对应 OWASP 2024 最低推荐值以上

**Rationale**：
- OWASP Password Storage Cheat Sheet 2024：最低 factor 10，推荐「以硬件允许的最高值」；factor 12 是当前库默认值与行业普遍实践
- 低流量内部应用：factor 12 下单次 hash 约 250–400ms，登录场景可接受，无性能压力
- passlib[bcrypt] 默认 rounds=12，无需额外配置，降低误配置风险
- factor 12 提供充足离线暴力破解抵抗，即使数据库泄露也有足够保护窗口

**Alternatives considered**：
- **Factor 10**：OWASP 最低线，可接受但裕度有限，不推荐新系统
- **Argon2id**（OWASP 第一推荐）：GPU/ASIC 抵抗更好，但 bcrypt factor 12 对低流量内部应用已足够，不引入额外依赖

**Evidence**：
- OWASP Password Storage Cheat Sheet：cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- passlib bcrypt 文档：passlib.readthedocs.io/en/stable/lib/passlib.hash.bcrypt.html（默认 rounds=12）
- solution.md 规则-0a：「密码只存 bcrypt hash（cost factor ≥ 12）」

**已知约束**：bcrypt 静默截断超过 72 字节的密码；MVP 密码最大长度建议前端限制 ≤ 72 字符，或用 SHA-256 预处理后再 hash

---

### T10. 快照存储方案裁决：SQLite（user_id FK）vs JSON 文件 + filelock

**Task**：裁决采集快照（snapshot）存储方案——是否随用户账号/竞对配置一并迁移到 SQLite，还是继续用 JSON 文件 + filelock（对应 V-005）

**Decision**：**快照迁移到 SQLite**，与用户账号和竞对配置同库；废弃 JSON 文件 + filelock 方案

**Rationale**：
- 引入多用户后，核心查询需求变为 `WHERE user_id = X AND competitor_id = Y ORDER BY crawled_at DESC LIMIT N`，SQLite 有索引支持（O(log n)），JSON 文件需扫描/解析整个目录（O(n)）
- filelock 方案仅按 URL 分文件，无法原生支持 user_id 过滤；按用户分目录的变通设计引入命名规范脆弱性
- SQLite WAL 模式：单写多读，APScheduler 单进程内 SQLite 写入无跨进程竞争，`busy_timeout=5000ms` 兜底
- 单库文件统一备份（`cp site.db site.db.bak`），比目录树更可靠
- 原 JSON 文件方案在无用户隔离时合理；引入多用户后结构性不匹配

**迁移路径**：
- 旧 `backend/data/{url_slug}.json` 文件：MVP 直接抛弃（内测无历史数据），上线即切换 SQLite
- 无需写迁移脚本（solution.md 第 9 轮：「不做数据迁移，MVP 直接切换」）

**Alternatives considered**：
- **继续 JSON 文件 + 按 user_id 分目录**：查询性能差，目录结构脆弱；已被排除
- **PostgreSQL**：查询能力强但需独立服务进程，MVP 单机部署不值
- **SQLite + HTML 快照写文件系统（混合）**：HTML 快照在 SQLite TEXT 列（<500KB）性能无问题，不需要混合

**Evidence**：
- 研究结论：「filelock JSON files are appropriate when... there is no multi-user scoping requirement」
- SQLite "fasterthanfs" 研究：BLOB < 100KB 读性能优于文件系统读
- solution.md V-005：「引入 SQLite 承载用户账号与竞对配置后，采集快照是否也迁移到 SQLite，由设计阶段裁决」
- prd.md §8 V-005 成功信号：「设计阶段产出明确结论并写入 design.md」——本任务关闭该条件

---

### T11. SQLite 并发写安全：FastAPI + APScheduler 单进程场景

**Task**：确认 SQLite 在 FastAPI + APScheduler 同进程内的并发写安全策略

**Decision**：启用 **WAL 模式** + `busy_timeout=5000ms` + SQLAlchemy `QueuePool`（`check_same_thread=False`）；APScheduler job 独立创建 Session

**Rationale**：
- WAL 模式：写者追加到 WAL 文件，读者并发读主 DB 文件——读写不互阻；解决 FastAPI 请求与 APScheduler 写任务的并发瓶颈
- `busy_timeout=5000ms`：写锁等待 5s 后才报错，消除瞬时锁竞争下的 `OperationalError: database is locked`
- 单进程无跨进程竞争，QueuePool 默认设置足够；`check_same_thread=False` 是 FastAPI 多线程场景的必要设置（SQLAlchemy 对文件 DB 自动配置）
- APScheduler job 必须自行创建 Session（不复用 FastAPI request scope 的 Session），避免跨线程 Session 共享

**关键约束**：
- SQLite 不支持多进程部署（WAL 的 `-shm` 共享内存文件跨进程不安全）；若后续需多 Uvicorn worker，必须迁移至 PostgreSQL
- `aiosqlite` 非真异步 I/O（底层 sqlite3 运行在线程），busy_timeout 同样需要配置

**Alternatives considered**：
- **NullPool**：每次操作新建连接，无池化开销，可完全消除锁竞争，但频繁连接/断开有性能开销；用于 debug 场景
- **StaticPool**：单连接共享，仅适合 in-memory SQLite 测试，生产不推荐

**Evidence**：
- SQLite WAL 官方文档：sqlite.org/wal.html（「readers never block writers, writers never block readers」）
- SQLAlchemy SQLite dialect 文档：docs.sqlalchemy.org/en/20/dialects/sqlite.html
- FastAPI + SQLite 配置示例：fastapi.tiangolo.com/tutorial/sql-databases/

## 风险与验证清单（未关闭项）

| 编号 | 风险/假设 | 验证方式 | 成功信号 | Owner | 截止 | 触发动作 |
|---|---|---|---|---|---|---|
| V-001 | Haiku 4.5 对 HTML diff 语义解读质量未验证 | 人工选 3-5 个已知变化页面，对比 AI 输出与人工判断 | 80%+ 正确识别 | 开发+PM | 内测第 1 周 | 不达标：升级至 Sonnet 4.6 或调整 prompt |
| V-002 | 目标网站反爬策略未知，采集稳定性无保证 | 部署后 7 天连续运行，统计成功率 | 成功率 >90% | 开发 | 内测第 2 周 | 不达标：引入代理池或降低频率 |

---

## D2 可直接引用的结论摘要

| 决策点 | 结论（机制级） | 研究任务 |
|---|---|---|
| LLM | claude-haiku-4-5 via Anthropic SDK，结构化 JSON 输出 | T1 |
| 调度 | APScheduler IntervalTrigger + max_instances=1 + tenacity 重试 | T2 |
| 采集 | requests+BS4 主采集，Playwright JS 渲染 fallback，UA 轮换+域名级延迟 | T3 |
| 数据存储（快照） | **SQLite**（user_id FK + competitor_id FK）+ WAL 模式；废弃 JSON 文件方案（V-005 关闭） | T10 |
| 前后端通信 | REST API（FastAPI）；Vercel 前端通过 NEXT_PUBLIC_API_BASE_URL 调用后端 | T5+T6 |
| 仓库结构/部署 | 同仓 GitHub；frontend/ 部署 Vercel，backend/ 独立运行；vercel.json 配置路由 | T6 |
| JWT secret | `secrets.token_hex(64)`（512 bit），存 `.env`；HS256；access token 24h + refresh 7d | T7 |
| 前端 token 存储 | httpOnly cookie（SameSite=Lax，Secure，跨域用 SameSite=None）；禁止 localStorage | T8 |
| 密码 hash | bcrypt cost factor 12（passlib 默认）；前端限制密码 ≤72 字符 | T9 |
| SQLite 并发安全 | WAL 模式 + busy_timeout=5000ms + QueuePool(check_same_thread=False) + APScheduler 独立 Session | T11 |

