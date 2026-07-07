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
- **推荐方向**：requests+BS4 为主采集层 + APScheduler 调度 + SQLite WAL 共享存储（Python 写/Node 读）；LLM 使用 Claude Haiku 4.5 做 HTML 变化语义解读；仓库在现有 myapp 内扩展 backend/ 子目录

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

### T4. 数据库选型：历史记录存储与查询

**Task**：确定 MVP 数据库选型，支持 Python 写入历史快照 + Node.js 前端查询历史记录

**Decision**：**SQLite（WAL 模式）** + **Alembic** 做 schema 迁移；`crawled_at` 字段加索引

**Rationale**：
- SQLite 零部署，文件即数据库，完全符合 MVP 最小复杂度
- WAL（Write-Ahead Logging）模式：`PRAGMA journal_mode=WAL` 允许并发侧管理 schema，Node.js 只读不迁移，职责清晰
- `crawled_at` 加索引支持前端"按时间查看历史"的查询性能

**迁移阈值**（何时切 PostgreSQL）：
- 历史记录超过 **50 万行**，或
- 需要多实例部署，或
- 需要全文检索（如搜索 AI 解读内容）

**Alternatives considered**：
- **PostgreSQL**：生产级，但需要独立服务进程，MVP 部署复杂度不值
- **MongoDB**：文档型存储适合变化数据，但 Node.js + Python 双驱动配置复杂，且 WAL 问题仍存在
- **直接 JSON 文件存储**：无法支持结构化查询与历史记录翻页

**Evidence**：
- SQLite WAL 文档：并发读写不冲突，写锁仅在 checkpoint 时出现
- Alembic 官方文档：`alembic upgrade head` 执行迁移

---

### T5. 前后端通信方式：Python 后端 ↔ Node.js 前端

**Task**：确定 Python 后端（写）与 Node.js 前端（读）的通信/数据共享方式

**Decision**：**共享 SQLite 文件**（Python 写 / Node.js 读），不引入 REST API 层

**Rationale**：
- Python 写入历史快照到 SQLite；Node.js 通过 `better-sqlite3`（同步）或 `sqlite3`（异步）直接查询同一文件
- WAL 模式保证 Python 写入时 Node.js 仍可读，无需锁等待
- 避免引入 Python REST API 服务（如 FastAPI），减少进程数与配置复杂度
- MVP 场景：同机部署，文件路径通过 `.env` 共享，无需网络通信

**注意事项**：
- Node.js 必须以只读方式打开 SQLite（`readonly: true`），避免意外写入破坏 Python 的事务
- 文件路径通过 `DATABASE_URL` 环境变量统一配置，Python 和 Node.js 同时读取

**Alternatives considered**：
- **REST API（FastAPI）**：Python 暴露 HTTP 接口供 Node.js 调用；增加一个服务进程，MVP 过度设计
- **消息队列（Redis/RabbitMQ）**：完全异步解耦，适合分布式，MVP 完全不需要
- **文件系统（JSON 文件）**：无结构化查询，历史记录翻页/过滤实现困难，不选

---

### T6. 仓库结构：现有 myapp 静态站如何扩展

**Task**：确定现有纯静态 myapp（index.html/styles.css/script.js）如何扩展以容纳 Python 后端和 Node.js 前端

**Decision**：**在现有 myapp 仓库内扩展**，新增 `backend/`（Python）和 `frontend/`（Node.js 应用）子目录；保留根目录现有静态文件不变

**Rationale**：
- 现有 `index.html` / `styles.css` / `script.js` 是 landing page，与监控系统无依赖关系，保留原位不动
- `backend/` 放 Python 采集服务：`requirements.txt`、`main.py`（APScheduler）、`models.py`（SQLAlchemy）、`alembic/`
- `frontend/` 放 Node.js 应用：`package.json`、历史记录展示页（Express 或静态构建）
- 同仓管理降低协作成本，`.env` 文件在根目录统一管理，两个子服务都能读取
- 不新建仓库，避免权限/CI 配置分散

**目录结构**：
```
myapp/                        # 现有 landing page 保留
├── index.html
├── styles.css
├── script.js
├── .env                      # 统一配置（MONITOR_INTERVAL, MONITOR_URLS, AI_API_KEY, DATABASE_URL）
├── backend/                  # 新增：Python 采集服务
│   ├── requirements.txt
│   ├── main.py               # APScheduler 入口
│   ├── scraper.py   # requests + Playwright
│   ├── llm.py                # Anthropic SDK 调用
│   ├── models.py             # SQLAlchemy models
│   └── alembic/              # 数据库迁移
└── frontend/                 # 新增：Node.js 历史记录展示
    ├── package.json
    └── ...
```

**Alternatives considered**：
- **新建独立仓库**：权限、CI、`.env` 管理分散，MVP 协作成本高，不选
- **全部合并进 Node.js 单体**：用 Node.js 做定时采集，失去 Python 采集生态优势（requests/Playwright/BS4）
- **Monorepo 工具（Turborepo/Nx）**：过度工程，MVP 两个子目录直接管理即可

**Evidence**：
- solution.md 第 7.1 节：「myapp 前端 → 扩展/新增页面；复用现有 Node.js 技术栈」
- solution.md 第 7.4 节：「现有 myapp 为纯静态页面，需设计阶段确认仓库结构」

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
| 数据库 | SQLite WAL + Alembic 迁移，crawled_at 索引 | T4 |
| 前后端通信 | 共享 SQLite 文件（Python 写 / Node.js 只读） | T5 |
| 仓库结构 | 现有 myapp 内扩展 backend/ + frontend/ 子目录，landing page 原位保留 | T6 |
