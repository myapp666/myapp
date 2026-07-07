---
title: 竞争情报监控系统 - D1 设计调研
status: done
date: 2026-07-07
feature: competitor-tracking
spec: 001-competitor-tracking
---

## 基本信息

- Date：2026-07-07
- Feature：竞争情报监控系统（competitor-tracking）
- Spec（分支 / ID）：001-competitor-tracking

## TL;DR（最大风险 + 推荐方向）

- **最大风险**：目标网站反爬策略未知，采集稳定性无法提前保证
- **推荐方向**：requests+BS4 为主采集层 + APScheduler 调度 + JSON 文件 + filelock（Python 后端内部存储）+ FastAPI REST API；前端 Vercel 部署（frontend/ 子目录），backend/ 独立运行；LLM 使用 Claude Haiku 4.5 做 HTML 变化语义解读

---

## 未知项 → 研究任务映射表

| 未知项来源（solution.md Context Gaps） | 研究任务编号 |
|---|---|
| LLM 选型未确定 | T1 |
| 定时采集调度机制未定 | T2 |
| 目标网站反爬策略未知 | T3 |
| 数据库选型未定 | T4 |
| 前后端通信方式未定 | T5 |
| 现有 myapp 为纯静态页面，仓库结构未定 | T6 |

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

## 风险与验证清单（未关闭项）

| 编号 | 风险/假设 | 验证方式 | 成功信号 | Owner | 截止 | 触发动作 |
|---|---|---|---|---|---|---|
| V-002 | 目标网站反爬策略未知，采集稳定性无保证 | 部署后 7 天连续运行，统计成功率 | 成功率 >90% | 开发 | 内测第 2 周 | 不达标：引入代理池或降低频率 |
| V-001 | Haiku 4.5 对 HTML diff 语义解读质量未验证 | 人工选 3-5 个已知变化页面，对比 AI 输出与人工判断 | 80%+ 正确识别 | 开发+PM | 内测第 1 周 | 不达标：升级至 Sonnet 4.6 或调整 prompt |

---

## D2 可直接引用的结论摘要

| 决策点 | 结论（机制级） | 研究任务 |
|---|---|---|
| LLM | claude-haiku-4-5 via Anthropic SDK，结构化 JSON 输出 | T1 |
| 调度 | APScheduler IntervalTrigger + max_instances=1 + tenacity 重试 | T2 |
| 采集 | requests+BS4 主采集，Playwright JS 渲染 fallback，UA 轮换+域名级延迟 | T3 |
| 数据存储 | JSON 文件 + filelock，每 URL 一个文件，按 crawled_at 倒序 | T4 |
| 前后端通信 | REST API（FastAPI/Flask）；Vercel 前端通过 NEXT_PUBLIC_API_BASE_URL 调用后端 | T5+T6 |
| 仓库结构/部署 | 同仓 GitHub；frontend/ 部署 Vercel，backend/ 独立运行；vercel.json 配置路由 | T6 |

