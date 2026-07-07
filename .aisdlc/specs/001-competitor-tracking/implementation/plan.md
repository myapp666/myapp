---
title: 竞争情报监控系统 实现计划（SSOT）
status: draft
date: 2026-07-07
spec: 001-competitor-tracking
---

> **必需技能：** `spec-execute`（按批次执行本计划）
> **上下文获取：** 必须先执行 `spec-context` 获取上下文，定位 `{FEATURE_DIR}`，失败即停止

**目标：** 在 `myapp` 仓库内新建 `backend/`（Python 采集服务）和 `frontend/`（Next.js 历史展示），通过 REST API 连接，部署到本地/VPS + Vercel，实现自动采集竞对网站变化并用 Claude Haiku 4.5 解读  
**范围：** In = `.env` 配置驱动的定时采集 + AI 解读 + JSON 文件存储 + FastAPI REST API + Next.js /monitor 页面 + Vercel 部署；Out = 登录/鉴权、告警推送、社媒抓取、多模型路由  
**架构：** Python 后端（APScheduler + FastAPI + filelock JSON）独立运行；Next.js 前端部署 Vercel；前端通过 `NEXT_PUBLIC_API_BASE_URL` 调用后端 REST API；同一 GitHub 仓库 `backend/` + `frontend/` 双子目录 + 根目录 `vercel.json`  
**验收口径：** AC-001~AC-010（`requirements/prd.md §6`）；V-001~V-004（`requirements/prd.md §8`）  
**影响范围：** 新建 `backend/`、`frontend/`、`vercel.json`；现有 `index.html`/`styles.css`/`script.js` 不修改  
**需遵守的不变量：** JSON 文件仅 Python 后端写入，前端只通过 REST API 读取；同一 URL 采集任务 `max_instances=1`；现有 landing page 根路由不变  
**子仓范围：** 无（无 `.gitmodules`）

---

## TL;DR

- **一句话目标**：新建 Python 采集后端 + Next.js 前端，自动采集竞对网站变化、AI 解读、JSON 存储、Vercel 展示
- **In/Out**：In = 采集 + 解读 + 存储 + 展示；Out = 鉴权/告警/社媒/多模型
- **关键路径**：① 后端 JSON 存储 + 采集 + AI 解读核心逻辑 → ② FastAPI REST API → ③ Next.js 前端 + Vercel 部署
- **最大风险**：V-002 目标网站反爬（内测第 2 周验证）；V-001 Haiku 4.5 解读质量（内测第 1 周验证）

---

## 范围与边界（In / Out）

- **In**：`backend/`（scraper + llm + storage + scheduler + api）、`frontend/`（Next.js /monitor 页面）、根目录 `vercel.json`
- **Out**：用户登录/鉴权/权限、Slack/邮件推送、社媒抓取、多模型路由、代理池（V-002 不达标时按需引入）
- **不变量**：
  - `index.html`/`styles.css`/`script.js` 保持不变
  - JSON 文件（`backend/data/{url_slug}.json`）仅 Python 写入
  - 同一 URL `max_instances=1`（APScheduler job 级别）
- **影响面**：
  - 新建：`backend/`、`frontend/`、`vercel.json`
  - 不修改：现有根目录 landing page 文件

---

## 影响范围与约束（来自 solution.md §7 Impact Analysis）

| 模块 | 影响类型 | 关键不变量 |
|---|---|---|
| 竞争情报监控系统（新建）| 新增服务 | 独立服务，无现有依赖 |
| myapp 前端（landing page）| 根目录不修改；新增 `vercel.json` 路由配置 | `vercel.json` 仅新增 `/monitor` 路由，根路径 `/` 继续服务 `index.html` |
| Python 后端（新建）| 新增服务 | 定时任务 + REST API 同进程；JSON 独占写入 |

**需遵守的不变量（逐条）**：
1. JSON 文件仅 Python 后端写入，前端只通过 REST API 读取（prd.md 规则-5）
2. 同一 URL 的采集任务 `max_instances=1`，防止并发写入（prd.md 规则-4）
3. `MONITOR_URLS` 中重复 URL 只采集一次（prd.md 规则-1）
4. HTML diff 为空（内容完全一致）不调用 LLM，不写入新记录（prd.md 规则-2）
5. LLM 调用失败时，写入记录但 summary 标记为 `"[AI 解读失败，原因: {error}]"`（prd.md 规则-3）
6. 现有 landing page 根路径不变；`vercel.json` 新增 `/monitor` 路由指向 `frontend/` 构建产物

**CONTEXT GAP（不阻断）**：项目无 `.aisdlc/project/` 知识库（无现有组件契约/ADR），见 design.md §4 标注。

---

## 里程碑与节奏

| 里程碑 | 任务集 | 交付物 | 时间目标 |
|---|---|---|---|
| M0：后端核心 | T1–T4 | `backend/` 可独立运行，采集 + AI 解读 + JSON 存储 + FastAPI 验证通过 | 开发启动后第 1 周 |
| M1：前端 + 部署 | T5–T7 | `frontend/` Vercel 可访问，`/monitor` 页面功能完整 | 开发启动后第 2 周 |
| M2：内测验收 | T8（验证） | V-001~V-004 全部通过，AC-001~AC-010 全部验收 | 内测第 2 周末 |

---

## 依赖与资源

- **环境**：Python 3.11+、Node.js 18+、pip、npm/pnpm
- **外部服务**：Anthropic API Key（`AI_API_KEY`，部署前验证有效）、Vercel 账号（首次部署前连接 GitHub 仓库，配置 Root Directory = `frontend/`）
- **权限**：GitHub 仓库 push 权限（触发 Vercel 自动部署）；目标服务器 SSH 访问权限（backend 部署）
- **数据**：监控目标 URL 至少 1 个（`.env` `MONITOR_URLS` 配置）

---

## 风险与验证

| # | 风险/假设 | 验证方式 | 成功信号 | 失败信号 | Owner | 截止 | 下一步动作 |
|---|---|---|---|---|---|---|---|
| V-001 | Haiku 4.5 解读质量 | 人工选 3–5 个已知变化页面对比 AI 输出与人工判断 | 80%+ 正确识别，summary 有价值 | 频繁输出"无变化"或语义不符 | 开发+PM | 内测第 1 周 | 不达标：升级至 Sonnet 4.6 或调整 prompt |
| V-002 | 采集稳定性 >90% | 部署后 7 天统计每 URL 成功/失败次数 | 成功率 >90% | 成功率 <70% 或频繁封禁 | 开发 | 内测第 2 周 | 不达标：引入代理池或降低 MONITOR_INTERVAL |
| V-005 | Vercel 部署正常 | 首次部署前完成 Dashboard 连接与 Root Directory 配置 | frontend/ 构建成功，HTTPS 可访问 | 构建失败或路由不生效 | 开发 | MVP 部署前 | 检查 vercel.json 路由与构建命令 |
| V-006 | Anthropic API Key 可用 | 部署前验证 AI_API_KEY 有效，预估月用量 | API 调用返回 200，解读非空 | 返回 429/401 | 开发 | MVP 部署前 | 补充额度或降低采集频率 |

---

## 验收口径（可追溯）

- 追溯：`requirements/prd.md §6 AC-001~AC-010`（全部 10 条）
- 追溯：`requirements/prd.md §8 V-001~V-004`（4 条验证项）
- 追溯：`requirements/solution.md §5 验证清单`
- **关键验收点摘要**：
  - AC-001：新增 URL 后重启，下一周期出现采集记录
  - AC-004：无变化不写入（规则-2）
  - AC-005：有变化时 change_type 非空，summary 为可读中文
  - AC-006：超时自动重试最多 3 次，不影响其他 URL
  - AC-008：前端 URL 下拉包含全部 MONITOR_URLS，选中后按 crawled_at 倒序展示
  - AC-009：单条展示 4 字段（crawled_at/change_type/summary/importance）
  - AC-010：≤3 步找到目标竞对最近一条记录

---

## NEEDS CLARIFICATION（未消除前不得进入 I2）

> 以下项目均已有验证方式，不阻断 I2 开始，但需在内测阶段按时验证并按触发动作执行。

无阻断性未知项。V-001/V-002 为内测验证项，不阻断开发。

---

## 任务清单（SSOT）

> 唯一执行清单与状态来源：用 `- [ ] / - [x]` 标记完成。  
> 命令默认面向 PowerShell；同一行多命令请用 `;` 分隔（不要用 `&&`）。

---

### Task T1：后端项目初始化与环境配置

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`backend/requirements.txt`
- 创建：`backend/.env.example`
- 创建：`backend/main.py`（入口骨架）

**验收点：**
- `backend/` 目录结构创建完成
- `pip install -r backend/requirements.txt` 无报错
- `backend/.env.example` 包含 `MONITOR_URLS`、`MONITOR_INTERVAL`、`AI_API_KEY`、`ALLOWED_ORIGINS` 四个字段

**步骤 1：创建目录结构与 requirements.txt**
- 修改点：新建 `backend/` 目录及如下文件结构：
  ```
  backend/
  ├── requirements.txt
  ├── .env.example
  ├── main.py
  ├── scraper.py
  ├── llm.py
  ├── storage.py
  ├── scheduler.py
  ├── api.py
  └── data/          # JSON 文件存储目录（gitignore）
  ```
- `requirements.txt` 内容：
  ```
  fastapi>=0.111.0
  uvicorn[standard]>=0.29.0
  apscheduler>=3.10.4
  requests>=2.31.0
  beautifulsoup4>=4.12.3
  playwright>=1.44.0
  anthropic>=0.28.0
  python-dotenv>=1.0.1
  tenacity>=8.3.0
  filelock>=3.14.0
  pydantic>=2.7.0
  ```

**步骤 2：创建 `.env.example`**
- 内容：
  ```
  MONITOR_URLS=https://example.com,https://competitor.com
  MONITOR_INTERVAL=60
  AI_API_KEY=your_anthropic_api_key_here
  ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
  ```

**步骤 3：创建 `main.py` 骨架（仅入口，T4 补全）**
- 内容：`if __name__ == "__main__":` + `uvicorn.run` 占位

**步骤 4：安装依赖并验证**
- Run: `cd backend ; pip install -r requirements.txt`
- Expected: 无报错，所有包安装成功

**步骤 5：提交**
- Commit message: `feat(backend): 初始化后端目录结构与依赖配置`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `backend/requirements.txt`
      - `backend/.env.example`
      - `backend/main.py`

---

### Task T2：JSON 文件存储模块（storage.py）

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`backend/storage.py`
- 创建：`backend/data/.gitkeep`
- 修改：`.gitignore`（追加 `backend/data/*.json`）

**验收点：**
- `save_record(url, record_dict)` 可写入 JSON，filelock 保护
- `get_records(url, limit=20)` 返回按 `crawled_at` 倒序的列表，最多 limit 条
- `get_urls()` 返回 `data/` 目录下所有已有记录的 URL 列表
- `get_record_by_id(record_id)` 返回单条记录或 None
- 并发写同一文件时，filelock 不死锁（`timeout=10`）
- JSON 文件结构：`{ "url": "...", "records": [...] }`，每条记录含 `id`、`url`、`crawled_at`、`html_content`、`change_type`、`summary`、`importance`

**步骤 1：实现 storage.py**
- 修改点：`backend/storage.py`
- 核心逻辑：
  - URL → 文件名：`url_slug = hashlib.md5(url.encode()).hexdigest()[:16]`（避免 URL 含特殊字符）
  - 读：`FileLock(path + ".lock")`，加载 JSON，按 `crawled_at` 倒序排序后返回前 limit 条
  - 写：`FileLock` 加锁 → 读当前文件 → append record → 写回（原子性保证）
  - `get_urls()`：扫描 `data/*.json`，读取每个文件的 `url` 字段返回列表

**步骤 2：手动测试写入与读取**
- Run: `cd backend ; python -c "from storage import save_record, get_records; save_record('https://example.com', {'id': '1', 'crawled_at': '2026-07-07T10:00:00Z', 'html_content': '<html/>', 'change_type': 'test', 'summary': 'test', 'importance': '低'}); print(get_records('https://example.com'))"`
- Expected: 打印包含一条记录的列表

**步骤 3：提交**
- Commit message: `feat(backend): 实现 JSON 文件存储模块（filelock 写安全）`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `backend/storage.py`
      - `backend/data/.gitkeep`
      - `.gitignore`

---

### Task T3：网页采集模块（scraper.py）+ AI 解读模块（llm.py）

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`backend/scraper.py`
- 创建：`backend/llm.py`

**验收点：**
- `fetch_html(url)` 返回 HTML 字符串；遇到 JS 渲染页面（检测到空 body）时自动 fallback 到 Playwright
- UA 轮换：每次请求随机选取 User-Agent
- 域名级随机延迟：同域名两次请求间隔 10–30s（`time.sleep(random.uniform(10, 30))`）
- `diff_html(old_html, new_html)` 返回 diff 字符串；内容无变化时返回空字符串
- `analyze_change(url, old_html, new_html, diff)` 调用 Claude Haiku 4.5，返回 `{"change_type": "...", "summary": "...", "importance": "低/中/高"}`
- LLM 调用失败时（API 错误/超时）不抛出异常，返回 `{"change_type": "", "summary": "[AI 解读失败，原因: {error}]", "importance": ""}` （prd.md 规则-3）

**步骤 1：实现 scraper.py**
- 核心逻辑：
  - `USER_AGENTS` 列表（10 个常见 UA）
  - `fetch_html(url, timeout=30)`：requests.get + BeautifulSoup；检测 `<body>` 内容是否为空 → Playwright fallback
  - `diff_html(old_html, new_html)`：使用 `difflib.unified_diff` 或直接字符串比较；返回 diff 或空字符串

**步骤 2：实现 llm.py**
- 核心逻辑：
  - `anthropic.Anthropic(api_key=AI_API_KEY)`
  - prompt：输入 URL + diff 摘要，要求输出 JSON `{change_type, summary, importance}`
  - 使用 `try/except` 捕获 `anthropic.APIError`；失败返回降级结构（规则-3）
  - model: `claude-haiku-4-5-20251001`

**步骤 3：手动验证采集**
- Run: `cd backend ; python -c "from scraper import fetch_html; html = fetch_html('https://example.com'); print(len(html), 'chars')"`
- Expected: 打印字符数（大于 0）

**步骤 4：提交**
- Commit message: `feat(backend): 实现网页采集与 Claude Haiku AI 解读模块`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `backend/scraper.py`
      - `backend/llm.py`

---

### Task T4：调度器（scheduler.py）+ FastAPI REST API（api.py）+ 主入口（main.py）

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`backend/scheduler.py`
- 创建：`backend/api.py`
- 修改：`backend/main.py`（补全入口，启动 APScheduler + FastAPI 同进程）

**验收点：**
- APScheduler `IntervalTrigger(minutes=MONITOR_INTERVAL)`，`max_instances=1`
- tenacity `@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=60))` 包裹单 URL 采集函数
- `GET /api/urls` 返回 `{"urls": ["...", "..."]}` 200
- `GET /api/snapshots?url=xxx&limit=20` 返回 `{"items": [...], "total": N}` 200；URL 不存在时返回 `{"items": [], "total": 0}`
- `GET /api/snapshots/{id}` 返回单条完整记录；不存在时 404
- CORS 允许 `ALLOWED_ORIGINS` 中的所有域名
- `python backend/main.py` 启动无报错，APScheduler 日志可见第一次触发

**步骤 1：实现 scheduler.py**
- 核心逻辑：
  - `setup_scheduler(app)` 函数：读取 `MONITOR_URLS` → 去重 → 为每个 URL 注册 `IntervalTrigger` job
  - job 函数：`fetch_html` → `diff_html` → 有变化则 `analyze_change` → `save_record`（含错误处理）
  - tenacity 重试包裹采集步骤（网络层），不包裹整个 job

**步骤 2：实现 api.py（FastAPI 路由）**
- 路由：
  - `GET /api/urls`：调用 `storage.get_urls()`
  - `GET /api/snapshots`：调用 `storage.get_records(url, limit)`
  - `GET /api/snapshots/{record_id}`：调用 `storage.get_record_by_id(id)`
- CORS：`fastapi.middleware.cors.CORSMiddleware`，`allow_origins=ALLOWED_ORIGINS.split(",")`

**步骤 3：补全 main.py**
- 同进程启动：`scheduler.start()` → `uvicorn.run(app, host="0.0.0.0", port=8000)`

**步骤 4：启动后端并验证 API**
- Run: `cd backend ; python main.py`（后台运行或另开终端）
- Run: `Invoke-RestMethod -Uri "http://localhost:8000/api/urls"`
- Expected: `{"urls": [...]}` 响应

**步骤 5：提交**
- Commit message: `feat(backend): 实现 APScheduler 调度器与 FastAPI REST API`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `backend/scheduler.py`
      - `backend/api.py`
      - `backend/main.py`

---

### Task T5：Next.js 前端初始化与 /monitor 页面实现

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`frontend/`（Next.js 项目，`npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir`）
- 创建/修改：`frontend/app/monitor/page.tsx`（主页面）
- 创建：`frontend/lib/api.ts`（API 调用封装）

**验收点：**
- `cd frontend ; npm run dev` 无报错，`http://localhost:3000/monitor` 可访问
- URL 下拉从 `GET /api/urls` 加载，默认选中第一项（AC-008）
- 切换 URL 后从 `GET /api/snapshots?url=xxx&limit=20` 加载历史，按 `crawled_at` 倒序展示（AC-008）
- 每行展示 4 字段：`crawled_at`（格式化 `YYYY-MM-DD HH:mm`）、`change_type`（标签）、`summary`（截断 200 字）、`importance`（低/中/高标签）（AC-009）
- 点击"展开详情"显示完整 summary（prototype.md §4.1.5）
- `NEXT_PUBLIC_API_BASE_URL` 未配置时展示配置缺失 banner（prd.md 异常-4）
- 空状态、加载状态、错误状态均已实现（prototype.md §4.1.3）

**步骤 1：初始化 Next.js 项目**
- Run: `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --eslint`
- Expected: `frontend/` 目录创建成功

**步骤 2：实现 `frontend/lib/api.ts`（API 封装）**
- 内容：
  - `getUrls()` → `GET {NEXT_PUBLIC_API_BASE_URL}/api/urls`
  - `getSnapshots(url, limit=20)` → `GET {NEXT_PUBLIC_API_BASE_URL}/api/snapshots?url=...&limit=20`
  - `NEXT_PUBLIC_API_BASE_URL` 未配置时抛出可捕获的错误

**步骤 3：实现 `frontend/app/monitor/page.tsx`**
- 按 prototype.md §4.1 实现：URL 下拉 + 历史列表 + 详情展开/折叠 + 各状态（加载/空/错误）
- 样式：Tailwind CSS，简洁可用即可（MVP 不做精细视觉）

**步骤 4：本地验证（需后端同时运行）**
- Run: `cd frontend ; npm run dev`
- 访问：`http://localhost:3000/monitor`
- Expected: URL 下拉有数据，历史列表按时间倒序，展开详情正常

**步骤 5：提交**
- Commit message: `feat(frontend): 实现 /monitor 历史记录页（Next.js）`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `frontend/`（新建目录）

---

### Task T6：Vercel 部署配置（vercel.json）

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 创建：`vercel.json`（根目录）
- 修改：`frontend/next.config.js`（如需调整输出配置）

**验收点：**
- `vercel.json` 配置 `builds`（Root Directory = `frontend/`）与 `routes`（`/monitor` → frontend；`/` → 根目录 `index.html`）
- GitHub push main 分支后 Vercel 自动触发构建，`https://{project}.vercel.app/monitor` HTTPS 可访问（V-005）
- 根路径 `/` 仍服务 `index.html`（不变量）

**步骤 1：创建 `vercel.json`**
- 内容：
  ```json
  {
    "builds": [
      { "src": "frontend/package.json", "use": "@vercel/next" },
      { "src": "index.html", "use": "@vercel/static" }
    ],
    "routes": [
      { "src": "/monitor(.*)", "dest": "frontend/$1" },
      { "src": "/(.*)", "dest": "/$1" }
    ]
  }
  ```

**步骤 2：在 Vercel Dashboard 配置项目**
- 连接 GitHub 仓库，Root Directory 选 `frontend/`
- 配置环境变量 `NEXT_PUBLIC_API_BASE_URL=https://{your-backend-host}:8000`

**步骤 3：push 触发部署验证**
- Run: `git push origin 001-competitor-tracking`（或 merge 到 main 触发）
- Expected: Vercel Dashboard 构建成功，`/monitor` HTTPS 可访问

**步骤 4：提交**
- Commit message: `feat(deploy): 添加 vercel.json 配置 Vercel 部署路由`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `vercel.json`

---

### Task T7：.gitignore 与项目收尾

- [ ] **状态**：未开始

**代码仓范围：** 根项目

**文件：**
- 修改：`.gitignore`（追加 `backend/data/*.json`、`backend/.env`、`frontend/.env.local`）
- 创建：`backend/README.md`（运维操作文档，V-004 依赖）

**验收点：**
- `backend/data/*.json` 不进入 git 追踪
- `backend/.env` 不进入 git 追踪
- `backend/README.md` 包含：`.env` 配置说明（MONITOR_URLS/MONITOR_INTERVAL/AI_API_KEY 格式）、启动命令、新增 URL 操作步骤
- 非开发人员按 README.md 可独立完成新增 URL 操作（V-004 验证前置）

**步骤 1：更新 `.gitignore`**
- 追加：`backend/data/*.json`、`backend/.env`、`frontend/.env.local`、`frontend/.next/`

**步骤 2：创建 `backend/README.md`（运维文档）**
- 内容：环境要求、`.env` 字段说明（每字段含示例值）、启动命令（`pip install` + `python main.py`）、新增监控 URL 的操作步骤（修改 `.env` MONITOR_URLS → 重启服务）、日志查看方式

**步骤 3：提交**
- Commit message: `chore: 更新 .gitignore，补充后端运维文档（V-004）`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `<TBD>`
    pr: `<TBD>`
    changed_files:
      - `.gitignore`
      - `backend/README.md`

---

### Task T8：内测验证（V-001~V-004）

- [ ] **状态**：未开始（内测阶段执行）

**代码仓范围：** 根项目（验证，不写代码）

**验收点：**
- V-001：Haiku 4.5 解读质量 ≥80%（内测第 1 周）
- V-002：7 天采集成功率 >90%（内测第 2 周）
- V-003：用户 2 分钟内完成查阅任务（内测第 2 周）
- V-004：非开发人员按文档独立完成新增 URL（内测第 1 周）

**步骤 1：V-001 AI 解读质量验证**
- 按 prototype.md §6.2 任务-3 执行
- 选取 3–5 个已知变化页面，对比 AI summary 与人工判断
- Expected: 正确识别率 ≥80%
- 失败动作：升级至 Sonnet 4.6（`llm.py` 中 model 字段改为 `claude-sonnet-4-6`）或调整 prompt

**步骤 2：V-002 采集稳定性验证**
- 部署后连续运行 7 天，统计每 URL 成功/失败次数（查看后端日志）
- Expected: 成功率 >90%
- 失败动作：引入代理池（修改 `scraper.py`）或降低 `MONITOR_INTERVAL`

**步骤 3：V-003 前端用户体验验证**
- 邀请 2–3 位内测用户按 prototype.md §6.2 任务-1 执行
- 记录步骤数与完成时间
- Expected: 全部用户 ≤3 步，≤2 分钟
- 失败动作：优化前端布局与信息层级（修改 `frontend/app/monitor/page.tsx`）

**步骤 4：V-004 .env 配置可维护性验证**
- 由运维按 `backend/README.md` 独立完成新增 1 个 URL 操作
- Expected: 全程无需开发介入，下一周期出现采集记录
- 失败动作：改写 README.md 或增加简单配置 UI

---

## Merge-back 待办清单（仅记录，不在本阶段执行）

- MB-001：实现完成后，将以下决策沉淀为 `project/adr/` ADR：
  - ADR-001：JSON 文件 + filelock 作为 MVP 存储（迁移阈值：>1 万条/URL 或多实例需求）
  - ADR-002：前后端部署分离（Vercel + 独立 VPS），REST API 为唯一数据通道
  - ADR-003：Claude Haiku 4.5 为默认 LLM，V-001 验证后可升级 Sonnet 4.6
- MB-002：若 V-001/V-002 触发降级/替代方案，回写 `design/design.md` 的 D1/D6 决策与验证结论
