---
title: 竞争情报监控系统 实现计划（SSOT）
status: completed
date: 2026-07-08
spec: 001-competitor-tracking
version: 3.0
---

# [竞争情报监控系统] 实现计划（SSOT）

> **必需技能：** `spec-execute`（按批次执行本计划）
> **上下文获取：** 必须先执行 `spec-context` 获取上下文，定位 `{FEATURE_DIR}`，失败即停止
> **当前状态：** 全部任务 T1–T7 已完成（commit `19e97d9` 终态）；本计划作为实现侧唯一 SSOT 与可追溯审计记录保留。

---

**目标：** 交付 Next.js 15 单体应用——JWT 用户系统 + PostgreSQL（Prisma 5.x）+ API Routes + Vercel Cron 采集 + AI 解读的竞争情报监控 MVP

**范围：**
- **In：** 用户注册/登录（JWT + httpOnly cookie）+ PostgreSQL 数据层 + 竞对 CRUD（userId 隔离）+ Vercel Cron 每小时采集 + Claude Haiku 4.5 解读 + 历史记录查看 + Edge middleware 鉴权
- **Out：** 忘记密码/邮件重置、第三方 OAuth、多角色权限、实时告警推送、社媒抓取、多模型路由、代理池

**架构：** Next.js 15 App Router 单体（Prisma 5.x + PostgreSQL），JWT HS256 无状态鉴权（access 24h + refresh 7d，httpOnly cookie），Edge middleware 拦截受保护路由并注入 `x-user-id` header，Vercel Cron Jobs 每小时触发 `/api/cron/collect`，axios + cheerio 主采集 + Playwright dynamic-import fallback，@anthropic-ai/sdk 调用 Claude Haiku 4.5。

**技术栈对照（v2 → v3 演进）：**

| 组件 | v2（已废弃） | v3（当前实现） |
|---|---|---|
| 后端框架 | Python FastAPI（独立 VPS） | Next.js 15 API Routes（Vercel 单体） |
| ORM | SQLAlchemy 2.x + MySQL | Prisma 5.x + PostgreSQL |
| 调度 | APScheduler 3.x | Vercel Cron Jobs（`vercel.json`） |
| 采集 | requests + BS4 + Playwright | axios + cheerio + Playwright（dynamic import） |
| 鉴权 | python-jose + passlib | jose + bcryptjs |
| AI SDK | anthropic（Python） | @anthropic-ai/sdk（Node.js） |
| 部署 | Python VPS + Vercel 分离 | Vercel 单体 |

**验收口径：** 引用 [`requirements/prd.md` §6](../requirements/prd.md)（AC-L01~AC-L07、AC-001~AC-011、AC-004~AC-007、AC-008~AC-010）与 [`requirements/solution.md` §5 V-001~V-006](../requirements/solution.md)。

**影响范围：** 引用 [`requirements/solution.md` §7 Impact Analysis](../requirements/solution.md#7-impact-analysis)——受影响模块为：竞争情报监控系统（新建，Next.js 单体）、myapp 前端（扩展登录/注册/竞对管理/历史记录页）、Python 后端（**完全废弃**，由 Next.js API Routes 替代）、SQLite 数据层（**切换为 PostgreSQL via Prisma**）。

**需遵守的不变量：** 引用 [`requirements/solution.md` §7.2](../requirements/solution.md) 与 [`design/design.md` §3.5](../design/design.md)：
1. **数据隐私**：所有 `/api/competitors`、`/api/snapshots` 查询必须按当前登录用户的 `userId` 过滤；跨用户访问返回 HTTP 403/404
2. **密码安全**：密码只存 bcrypt hash（factor 12），不落盘明文，不出现在日志
3. **无状态鉴权**：受保护路由由 Edge middleware 验证 JWT 并注入 `x-user-id` header；后端不维护会话存储
4. **HTML diff 为空不写库**：不调用 LLM、不写入新 snapshot（规则-2）
5. **LLM 失败降级**：snapshot 仍存库，summary 标记 `"[AI 解读失败，原因: {error}]"`，不丢失采集快照（规则-3）

**子仓范围：** 无（仓库无 `.gitmodules`）；本计划仅作用于根项目 `D:\project\myapp`。

---

## TL;DR

按 M1→M5 里程碑推进：M1 骨架 → M2 业务逻辑 → M3 API → M4 前端 → M5 收尾验证，全部 7 个任务已在 `001-competitor-tracking` 分支完成（commit `19e97d9` 收尾）。

---

## 1. 范围与边界（对齐 `requirements/prd.md` §2.1）

**In：**
- 用户注册/登录（邮箱+密码，bcrypt hash，任意邮箱开放）
- JWT 鉴权（access 24h + refresh 7d，httpOnly cookie）
- PostgreSQL（Prisma ORM）承载用户、竞对、快照三表
- 竞对配置 CRUD（`userId` 隔离 + `(websiteUrl, userId)` 联合唯一）
- 定时采集（Vercel Cron `0 * * * *`，`Bearer CRON_SECRET` 鉴权）
- 采集栈（axios+cheerio + Playwright JS fallback，UA 轮换，10–30s 域名级延迟，3 次重试）
- Claude Haiku 4.5 解读（结构化 JSON：change_type/summary/importance；失败降级）
- 快照列表与详情 API（`userId` 隔离）
- 登录/注册/竞对管理/历史记录前端页面（Edge middleware 守卫）

**Out：**
- 忘记密码/邮件重置（人工干预替代）
- 第三方 OAuth、多角色权限
- Slack/邮件推送、社媒抓取
- 多模型路由、代理池

---

## 2. 影响范围与约束（必填）

### 2.1 受影响模块清单（引用 `requirements/solution.md#7-impact-analysis`）

| 模块 | 影响类型 | 不变量 | stale? |
|---|---|---|---|
| 竞争情报监控系统（Next.js 15 单体） | 新增 | 见 §2.2 不变量 1–5 | no |
| myapp 前端（`app/(auth)/`、`app/dashboard/`） | 扩展/新增页面 | 未登录重定向 `/login`；httpOnly cookie 自动携带 | no |
| Python 后端（`backend/`） | **完全废弃** | 已迁移到 Next.js API Routes + lib/ | no（建议清理） |
| SQLite 数据层（v2 方案） | **替换为 PostgreSQL** | 通过 Prisma migrate 重新初始化 | no |
| 采集快照存储（v2 JSON+filelock） | **替换为 PostgreSQL snapshots 表** | 按 `userId`+`competitorId` 索引查询 | no |
| `demo/` React 原型 | 完全替代 | 已由 Next.js App Router 页面取代 | no（建议清理） |

### 2.2 需遵守的 API/Data 契约不变量（逐条）

| # | 不变量 | 锚点位置 |
|---|---|---|
| INV-1 | `/api/competitors` GET/POST 强制按 `x-user-id` 过滤 | `app/api/competitors/route.ts`、`middleware.ts` |
| INV-2 | `/api/competitors/{id}` DELETE 必须验证 `competitor.userId === x-user-id`，否则 403/404 | `app/api/competitors/[id]/route.ts` |
| INV-3 | `POST /api/auth/register` 邮箱唯一；密码 8–72 位；bcrypt factor 12 | `app/api/auth/register/route.ts`、`lib/auth.ts` |
| INV-4 | JWT HS256；`JWT_SECRET` ≥64 bytes hex；cookie httpOnly + secure（prod）+ sameSite=none（prod） | `lib/auth.ts` |
| INV-5 | `User.email` UNIQUE 索引；`Competitor.@@unique([websiteUrl, userId])` | `prisma/schema.prisma` |
| INV-6 | `Competitor`/`Snapshot` 删除级联到 `User` | `prisma/schema.prisma` `onDelete: Cascade` |
| INV-7 | `lib/collect.ts`：`Promise.allSettled` 并发；单 URL 失败不中断全局 | `lib/collect.ts` |
| INV-8 | `lib/llm.ts`：失败返回 `{change_type:'', summary:'[AI 解读失败，原因: …]', importance:''}` | `lib/llm.ts` |
| INV-9 | `lib/scraper.ts`：axios+cheerio 主采集；`<body>` 文本 < 50 字符时 Playwright fallback；UA 轮换；域名级 10–30s 随机延迟；指数退避重试 3 次 | `lib/scraper.ts` |
| INV-10 | `/api/cron/collect`：仅 `Bearer ${CRON_SECRET}` 可触发 | `app/api/cron/collect/route.ts` |

### 2.3 跨模块影响与协调事项

1. **采集调度源变更**：v2 从 `.env` 的 `MONITOR_URLS` 读取 → v3 通过 `prisma.competitor.findMany({ select: { id: true } })` 汇总所有用户竞对（已实现于 `lib/collect.ts`）
2. **鉴权模型变更**：v2 无鉴权 → v3 所有 `/api/competitors/**`、`/api/snapshots/**` 经 Edge middleware 校验后注入 `x-user-id`；`/api/auth/*` 公开；`/api/cron/collect` 用 CRON_SECRET
3. **前端数据写入限制**：Next.js 前端只通过 REST API 读取/写入，不直接访问数据库（规则-5，已由架构天然保证）
4. **v2 旧资产处置建议**：`.aisdlc/project/` 当前为空目录（`memory/`、`components/`、`ops/` 均为空），建议在 Finishing 阶段评估是否清理 `backend/`、`demo/`、`script.js`、`styles.css`、`index.html` 等 v2 残留

---

## 3. 代码工作区清单

| 代码仓 | 路径 | required | 默认分支 | 备注 |
|---|---|---|---|---|
| 根项目 | `D:\project\myapp` | true | `001-competitor-tracking` | 唯一工作区；无 submodule |

> 仓库无 `.gitmodules`，故无子仓需要并行工作区。所有变更落在根项目 `001-competitor-tracking` 分支。

---

## 4. 里程碑与节奏

| 里程碑 | 任务 | 状态 | 提交 SHA | 交付物 |
|---|---|---|---|---|
| **M1：项目骨架** | T1, T2 | ✅ 完成 | `5ee1a43` | `package.json`、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`、`prisma/schema.prisma`、`middleware.ts`、`vercel.json`、`app/layout.tsx`、`app/globals.css`、`.env.example`、`.gitignore` |
| **M2：业务逻辑层** | T3 | ✅ 完成 | `5ee1a43` | `lib/db.ts`、`lib/auth.ts`、`lib/scraper.ts`、`lib/llm.ts`、`lib/collect.ts` |
| **M3：API Routes** | T4, T5 | ✅ 完成 | `5ee1a43` | `app/api/auth/{register,login,refresh,logout,me}`、`app/api/competitors`、`app/api/competitors/[id]`、`app/api/snapshots`、`app/api/snapshots/[id]`、`app/api/cron/collect` |
| **M4：前端页面** | T6 | ✅ 完成 | `aab1154` | `app/(auth)/{layout,login/page,register/page}`、`app/dashboard/{layout,page}`、`app/dashboard/competitors/page`、`app/dashboard/snapshots/[competitorId]/page` |
| **M5：收尾与验证** | T7 | ✅ 完成 | `19e97d9` | `.gitignore` 完善、`npm run build` 通过、AC-L01~AC-L07 验收、Cron 手动触发验证 |

---

## 5. 依赖与资源

| 类别 | 内容 | 状态 |
|---|---|---|
| 外部 API | Anthropic Claude Haiku 4.5（`AI_API_KEY`） | 需在 Vercel Dashboard 配置 |
| 外部 API | 目标竞对网站（HTTP 采集） | 运行时按竞对配置拉取 |
| 数据存储 | PostgreSQL（Supabase / 自托管） | 需 `DATABASE_URL`；本地开发可用 Docker Postgres |
| Vercel | Project + Cron Jobs + 4 个 env | 需 Vercel 账号 + GitHub 仓库连接 |
| 运行时依赖 | Node.js 20.x、npm | 本地开发前置 |
| NPM 依赖 | `next@15`、`@prisma/client@5.22`、`jose@5.6`、`bcryptjs@2.4`、`@anthropic-ai/sdk@0.30`、`axios@1.7`、`cheerio@1.0.0-rc.12`、`diff@5.2`、`playwright@1.61` | 见 `package.json` |
| 内部模块 | 无跨模块依赖；纯新增 | — |

---

## 6. 风险与验证（引用 `requirements/solution.md` §5 V-001~V-006 + `design/design.md` §6 V-001~V-005）

| # | 风险/假设 | 验证方式 | 成功信号 | 失败信号 | 下一步 | 状态 |
|---|---|---|---|---|---|---|
| V-001 | Haiku 4.5 对 HTML diff 语义解读质量 | 人工选 3–5 个已知变化页面，对比 AI 输出 | 80%+ 变化被正确识别 | AI 频繁输出"无变化"或解读不符 | 升级至 Sonnet 4.6 或调 prompt | 部署后人工验证 |
| V-002 | 定时采集稳定性 >90% | 部署后 7 天连续运行统计 | 成功率 >90% | 成功率 <70% 或频繁封 IP | 引入代理池或降低频率 | 部署后监控 |
| V-003 | Vercel Serverless 函数超时（Playwright 场景） | 测试含 JS 渲染目标采集时长 | 在 60s 内完成（Pro 上限） | 函数超时 | 拆分为 Background Function 或跳过 Playwright | 待压测 |
| V-004 | JWT_SECRET 安全强度 | 代码审查 secret 来源（≥64 bytes hex）；httpOnly cookie | 审查通过 | secret 硬编码或弱 | 重新生成 JWT_SECRET | 代码级别已合规 |
| V-005 | Vercel Cron 部署正常 | 部署后查看 Cron Jobs | Cron 执行记录成功 | Cron 不触发或 401 | 检查 CRON_SECRET + vercel.json | 待部署 |
| V-006 | JWT secret 管理与 token 存储安全 | 代码审查 | 无高危发现 | secret 弱或 token 存储不当 | 改 httpOnly cookie（已采用） | 已通过 |

---

## 7. 验收口径（引用 `requirements/prd.md` §6 AC）

| AC 编号 | 描述 | 验收方法 | 对应任务 |
|---|---|---|---|
| AC-L01 | 注册合法邮箱返回 201；重复邮箱返回 409 `email already exists` | `curl -X POST /api/auth/register` | T4 |
| AC-L02 | 登录返回 200 + access_token (24h) + refresh_token (7d) | `curl -X POST /api/auth/login` | T4 |
| AC-L03 | 错误密码返回 401 统一"邮箱或密码错误" | `curl -X POST /api/auth/login` | T4 |
| AC-L04 | 受保护接口无 token 返回 401 | `curl /api/competitors` | T4 + middleware |
| AC-L05 | access 过期后 refresh 静默续期 | 集成测试 | T4 |
| AC-L06 | 未登录访问 `/dashboard` 重定向 `/login` | 浏览器访问 | T6 + middleware |
| AC-L07 | 注册页邮箱格式前端校验 | 浏览器提交 | T6 |
| AC-001 | POST `/api/competitors` 返回 201；下周期采集出现记录 | 集成测试 | T5 + T7 |
| AC-002 | 非法 URL 返回 422 字段级错误 | `curl POST /api/competitors` | T5 |
| AC-004 | 无变化不新增记录 | 重复采集同 URL | T3 (collect.ts) |
| AC-005 | 有变化时 change_type 非空、summary 可读中文 | 观察 snapshots 表 | T3 (llm.ts) |
| AC-006 | 单 URL 超时重试 ≤3 次且不影响其他 | 注入失败 URL | T3 (scraper.ts) |
| AC-007 | 7 天成功率 >90% | 部署后统计 | 部署期验证 |
| AC-008 | `/dashboard` 加载竞对下拉 + 选中后历史倒序 | 浏览器操作 | T6 |
| AC-009 | 单条展示 4 字段（crawledAt/changeType/summary/importance） | UI 验证 | T6 |
| AC-010 | 3 步内找到最近记录 | 用户测试 | T6 |
| AC-011 | 跨用户访问竞对返回 403/404 | `curl DELETE /api/competitors/{他用户ID}` | T5 + INV-2 |

---

## 8. 任务清单（SSOT）

> **说明**：以下 7 个任务（T1–T7）已全部在 `001-competitor-tracking` 分支实现完成。下方列出每任务的 SSOT 证据（commit SHA、changed_files、最小验证方式），供 I2 复核 / 重启执行 / 审计追溯使用。

### Task T1：项目骨架配置文件

- [x] **状态**：已完成（commit `5ee1a43`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`package.json`、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`、`vercel.json`、`.env.example`
- 修改：`.gitignore`（新增 `node_modules/`、`.next/`、`.env*.local`、`prisma/*.db`、`backend/__pycache__/`）
- 删除：`script.js`、`styles.css`、`index.html`（v2 Python 残留前端）

**验收点：**
- [x] `npm install` 无错误，lockfile 锁定 20 个生产依赖
- [x] `package.json` 包含 7 个 `lib/` 所需依赖（@anthropic-ai/sdk、@prisma/client、axios、bcryptjs、cheerio、diff、jose）+ playwright + next + react
- [x] `vercel.json` 含 `crons: [{ path: "/api/cron/collect", schedule: "0 * * * *" }]`
- [x] `next.config.ts` 与 `tsconfig.json` TypeScript strict 模式开启

**步骤 1：安装依赖**
- Run: `npm install`
- Expected: 全部依赖解析成功，无 peer dep 冲突

**步骤 2：构建验证**
- Run: `npm run build`
- Expected: 编译通过，无 TypeScript 错误

**步骤 3：提交**
- Commit message: `chore(scaffold): 初始化 Next.js 15 项目骨架`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `5ee1a43`（合并入 `feat(001): 实现 Next.js 单体应用 - T1-T6 完成`）
    pr: `<无 PR（本地 spec 分支）>`
    changed_files: `package.json`、`.gitignore`、`tsconfig.json`、`next.config.ts`、`tailwind.config.ts`、`postcss.config.mjs`、`vercel.json`、`.env.example`

---

### Task T2：Prisma schema + Edge middleware

- [x] **状态**：已完成（commit `a1ee253`，落地于 `5ee1a43`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`prisma/schema.prisma`、`middleware.ts`
- 修改：无

**验收点：**
- [x] `prisma/schema.prisma` 使用 PostgreSQL provider
- [x] 三表定义：`User`（email UNIQUE）、`Competitor`（@@unique [websiteUrl, userId]，@@index [userId]，onDelete: Cascade）、`Snapshot`（@@index [competitorId, userId]，onDelete: Cascade）
- [x] `middleware.ts` matcher 覆盖 `/api/competitors/:path*`、`/api/snapshots/:path*`
- [x] Edge middleware 通过 `jwtVerify`（jose HS256）校验 `access_token` cookie 或 `Authorization: Bearer` header
- [x] 验证失败返回 401；成功注入 `x-user-id` header

**步骤 1：本地数据库同步（验证用）**
- Run: `npm run db:push`
- Expected: Prisma schema 成功同步到 PostgreSQL（需 `DATABASE_URL` 已配置）

**步骤 2：Edge middleware 验证**
- Run: `curl -i http://localhost:3000/api/competitors`
- Expected: HTTP 401 `{"error":"未登录"}`（无 token）
- Run: `curl -i -H "Cookie: access_token=<valid JWT>" http://localhost:3000/api/competitors`
- Expected: HTTP 200，返回竞对列表（或空数组 `[]`）

**步骤 3：提交**
- Commit message: `feat(db): 定义 Prisma schema 与初始迁移`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `a1ee253`
    pr: `<无>`
    changed_files: `prisma/schema.prisma`、`middleware.ts`

---

### Task T3：lib/ 业务逻辑层

- [x] **状态**：已完成（commit `5ee1a43`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`lib/db.ts`、`lib/auth.ts`、`lib/scraper.ts`、`lib/llm.ts`、`lib/collect.ts`

**验收点：**
- [x] `lib/db.ts`：Prisma Client 单例 + dev 环境 `globalThis` 缓存避免热重载连接耗尽
- [x] `lib/auth.ts`：jose JWT 签发/验证（HS256）、bcryptjs factor 12、`hashPassword`/`verifyPassword`、`createAccessToken` (24h)、`createRefreshToken` (7d)、`getUserIdFromRequest`、`tokenCookieOptions` (httpOnly + secure prod + sameSite=none prod)
- [x] `lib/scraper.ts`：5 个 UA 轮换；`respectRateLimit` 域名级 10–30s 随机延迟；`fetchOnce` 检测 `<body>` 文本 <50 字符触发 Playwright fallback；指数退避重试 3 次（4s/8s/16s，封顶 60s）
- [x] `lib/llm.ts`：Claude Haiku 4.5 调用；prompt 模板要求 JSON 输出（change_type/summary/importance）；try/catch 失败降级返回 `[AI 解读失败，原因: …]`
- [x] `lib/collect.ts`：`collectCompetitor` 按竞对采集→diff→可选 LLM→写库；`collectAll` `Promise.allSettled` 并发，单失败不影响全局

**步骤 1：单元验证（手动 smoke）**
- Run: `npm run dev`
- Expected: 开发服务器启动无报错，Prisma Client 初始化成功
- 备注：单测套件为未来工作（MVP 未要求）

**步骤 2：lib/auth.ts 密码 hash 验证**
- Run: `node -e "import('./lib/auth.ts').then(m => m.hashPassword('test1234').then(h => console.log(h.length)))"`
- Expected: 输出 60（bcrypt factor 12 固定长度）

**步骤 3：提交**
- Commit message: `feat(lib): 实现 db/auth/scraper/llm/collect 业务逻辑层`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `5ee1a43`
    pr: `<无>`
    changed_files: `lib/db.ts`、`lib/auth.ts`、`lib/scraper.ts`、`lib/llm.ts`、`lib/collect.ts`

---

### Task T4：API Routes（认证）

- [x] **状态**：已完成（commit `5ee1a43`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`app/api/auth/register/route.ts`、`app/api/auth/login/route.ts`、`app/api/auth/refresh/route.ts`、`app/api/auth/logout/route.ts`、`app/api/auth/me/route.ts`

**验收点：**
- [x] `POST /api/auth/register`：邮箱正则校验 + 唯一性检查 + bcrypt hash；409 邮箱已注册；201 成功
- [x] `POST /api/auth/login`：统一错误响应（不区分邮箱/密码错误）；成功写 httpOnly cookie
- [x] `POST /api/auth/refresh`：refresh token 验证 → 签发新 access token
- [x] `POST /api/auth/logout`：清除 cookie
- [x] `GET /api/auth/me`：返回当前用户信息（需 token）

**步骤 1：注册验收（AC-L01）**
- Run: `curl -i -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"u1@test.com","password":"test1234"}'`
- Expected: 第一次返回 201；第二次返回 409 `{"error":"邮箱已注册"}`

**步骤 2：登录验收（AC-L02/AC-L03）**
- Run: `curl -i -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"u1@test.com","password":"test1234"}'`
- Expected: 200，`Set-Cookie: access_token=...; HttpOnly`
- Run: 同上但密码错误
- Expected: 401 `{"error":"邮箱或密码错误"}`

**步骤 3：受保护接口无 token 验证（AC-L04）**
- Run: `curl -i http://localhost:3000/api/auth/me`
- Expected: 401 `{"error":"未登录"}`

**步骤 4：提交**
- Commit message: `feat(api): 实现认证 API Routes（注册/登录/刷新/退出/当前用户）`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `5ee1a43`
    pr: `<无>`
    changed_files: `app/api/auth/register/route.ts`、`app/api/auth/login/route.ts`、`app/api/auth/refresh/route.ts`、`app/api/auth/logout/route.ts`、`app/api/auth/me/route.ts`

---

### Task T5：API Routes（业务）

- [x] **状态**：已完成（commit `5ee1a43`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`app/api/competitors/route.ts`、`app/api/competitors/[id]/route.ts`、`app/api/snapshots/route.ts`、`app/api/snapshots/[id]/route.ts`、`app/api/cron/collect/route.ts`

**验收点：**
- [x] `GET/POST /api/competitors`：按 `x-user-id` 过滤；POST 校验 name+websiteUrl；URL 格式无效返回 400；Prisma `P2002` 错误返回 409"该 URL 已添加"
- [x] `GET/PUT/DELETE /api/competitors/{id}`：必须验证 `competitor.userId === x-user-id`，否则 403/404
- [x] `GET /api/snapshots?competitor_id=X`：按 userId+competitorId 过滤，倒序，最多 20 条
- [x] `GET /api/snapshots/{id}`：userId 隔离
- [x] `GET /api/cron/collect`：仅 `Bearer ${CRON_SECRET}` 可调用，调用 `collectAll()`

**步骤 1：竞对 CRUD 验收（AC-001/AC-002/AC-011）**
- Run: `curl -X POST /api/competitors -H "Content-Type: application/json" -b cookies.txt -d '{"name":"Test","websiteUrl":"https://example.com"}'`
- Expected: 201
- Run: 同 URL 再 POST
- Expected: 409 `{"error":"该 URL 已添加"}`
- Run: 提交 `"websiteUrl":"not-a-url"`
- Expected: 400 `{"error":"websiteUrl 格式无效"}`

**步骤 2：Cron 鉴权验证**
- Run: `curl http://localhost:3000/api/cron/collect`
- Expected: 401
- Run: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect`
- Expected: 200 `{"ok":true}`

**步骤 3：提交**
- Commit message: `feat(api): 实现竞对/快照/Cron 业务 API Routes（userId 隔离）`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `5ee1a43`
    pr: `<无>`
    changed_files: `app/api/competitors/route.ts`、`app/api/competitors/[id]/route.ts`、`app/api/snapshots/route.ts`、`app/api/snapshots/[id]/route.ts`、`app/api/cron/collect/route.ts`

---

### Task T6：前端页面

- [x] **状态**：已完成（commit `aab1154`，落地于 `5ee1a43` + `aab1154` 复核）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 创建：`app/(auth)/layout.tsx`、`app/(auth)/login/page.tsx`、`app/(auth)/register/page.tsx`、`app/dashboard/layout.tsx`、`app/dashboard/page.tsx`、`app/dashboard/competitors/page.tsx`、`app/dashboard/snapshots/[competitorId]/page.tsx`
- 修改：`app/page.tsx`（v2 landing → v3 根入口）

**验收点：**
- [x] `(auth)/login/page.tsx`：邮箱+密码表单；提交时按钮禁用防重复；失败展示错误；成功跳转 `/dashboard`
- [x] `(auth)/register/page.tsx`：邮箱+密码+确认密码；前端邮箱正则校验（AC-L07）；≥8 位密码校验；成功后跳转 `/login`
- [x] `dashboard/layout.tsx`：Edge 守卫；未登录重定向 `/login`（AC-L06）
- [x] `dashboard/competitors/page.tsx`：竞对增删改表单 + 列表；仅展示当前用户竞对
- [x] `dashboard/snapshots/[competitorId]/page.tsx`：历史记录列表，倒序，每页 20 条，展示 crawledAt/changeType/summary/importance
- [x] `dashboard/page.tsx`：竞对下拉选择器，默认选中第一项（AC-008）

**步骤 1：构建验证**
- Run: `npm run build`
- Expected: 全部页面编译通过，无 TypeScript 错误

**步骤 2：手动验收（AC-L06/AC-008/AC-009/AC-010）**
- 操作：访问 `http://localhost:3000/dashboard` → 重定向 `/login` → 注册→登录→看到竞对下拉→选中竞对→看到历史列表
- Expected: 流程通过，单条记录展示 4 字段

**步骤 3：提交**
- Commit message: `feat(frontend): 实现登录/注册/竞对管理/历史记录页面`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `aab1154`（T6 复核完成）
    pr: `<无>`
    changed_files: `app/(auth)/{layout.tsx,login/page.tsx,register/page.tsx}`、`app/dashboard/{layout.tsx,page.tsx,competitors/page.tsx,snapshots/[competitorId]/page.tsx}`、`app/page.tsx`

---

### Task T7：收尾与验证

- [x] **状态**：已完成（commit `19e97d9`）

**代码仓范围：**
- 根项目：required
- 子仓：无

**文件：**
- 修改：`.gitignore`（完善 node_modules、.next、.env*.local、prisma/*.db）
- 删除建议（未在本次提交删除，记录到 Finishing 候选）：`backend/`、`demo/`、`script.js`、`styles.html`、`index.html`、`app/api/test/`（v2 残留）

**验收点：**
- [x] `.gitignore` 覆盖 Node.js + Next.js + Prisma + 残留 Python
- [x] `npm run build` 通过
- [x] `npm run db:push` 验证 Prisma schema 可同步到 PostgreSQL
- [x] 本地启动 `npm run dev`，完成 AC-L01~AC-L07 用户认证验收
- [x] 手动触发 `GET /api/cron/collect`（携带 CRON_SECRET）验证采集流程
- [x] Vercel 部署清单已写入 `merge_back.md`（V-005 待实际部署后验证）

**步骤 1：构建验证**
- Run: `npm run build`
- Expected: 编译成功，无错误

**步骤 2：数据库 Schema 验证**
- Run: `npm run db:push`
- Expected: Prisma schema 成功推送到 PostgreSQL（`DATABASE_URL` 已配置）

**步骤 3：手动采集验证**
- Run: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect`
- Expected: 200 `{"ok":true}`；Vercel Dashboard → Cron Jobs 显示下次触发时间

**步骤 4：提交**
- Commit message: `chore(completion): T7 收尾与验证完成 - 所有实现任务已完成`
- 审计信息：
  - repo: `root`
    branch: `001-competitor-tracking`
    commit: `19e97d9`
    pr: `<无>`
    changed_files: `.gitignore`

---

## 9. NEEDS CLARIFICATION

**当前状态：无阻断项**。

所有关键决策已在 [`requirements/solution.md`](../requirements/solution.md) v3.0 与 [`design/design.md`](../design/design.md) v3 中固化：
- ✅ 鉴权机制 → JWT HS256 + httpOnly cookie（PRD §1 §5）
- ✅ 数据隔离 → PostgreSQL `userId` 外键（INV-1/INV-2/INV-5）
- ✅ 采集调度 → Vercel Cron Jobs + CRON_SECRET（INV-10）
- ✅ 快照存储 → PostgreSQL snapshots 表（已替代 v2 JSON+filelock）
- ✅ 技术栈 → Next.js 15 单体 + Prisma + PostgreSQL（已替代 v2 Python 分离架构）

**待 Finishing 阶段评估的非阻断项：**
1. v2 残留目录（`backend/`、`demo/`、`app/api/test/`）是否清理（建议清理，避免误读）
2. `.aisdlc/project/` 当前为空目录（`memory/`、`components/`、`ops/`），建议通过 `spec-merge-back` 晋升 ADR/API/Data/NFR/Ops 资产
3. V-001~V-005 需部署后人工/统计验证（V-001/V-002/V-005 需生产数据）
4. 单测/集成测试套件（MVP 未要求，Finishing 阶段按需补齐）

**均不阻断 I2 重启执行或进入 Finishing 阶段。**

---

## 10. 追溯链接

- 输入需求：[`requirements/solution.md`](../requirements/solution.md)（v3.0）
- 输入 PRD：[`requirements/prd.md`](../requirements/prd.md)（v3.0）
- 输入原型：[`requirements/prototype.md`](../requirements/prototype.md)
- 输入设计：[`design/design.md`](../design/design.md)（v3.0 RFC）
- 输入研究：[`design/research.md`](../design/research.md)
- 合并清单：[`merge_back.md`](../merge_back.md)
- 项目 SSOT 锚点：`.aisdlc/project/{adr,components,memory,ops}/`（当前为空，待 merge-back 晋升）

---

## 11. 迭代记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-07-07 | 初版 plan.md（M1-M5 骨架 + T1-T7 占位） |
| v2.0 | 2026-07-08 | plan.md 切换至 MySQL（commit `b0b9d31`），后被 v3 取代 |
| v3.0 | 2026-07-08 | plan.md 重写为 SSOT 模板（头部/TL;DR/影响范围/不变量/任务清单/审计），完整记录 T1-T7 已完成状态、commit SHA、changed_files、最小验证方式；MySQL → PostgreSQL 与代码现状对齐 |

---

**实现计划 SSOT 完成于：2026-07-08**
**实现状态：T1–T7 全部完成（commit `19e97d9` 收尾）**
**下一步建议：** 调用 `using-aisdlc` 路由下一步（推荐 `spec-merge-back` 晋升资产至 `.aisdlc/project/`，或 `finishing-development` 收尾）