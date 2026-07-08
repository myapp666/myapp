---
title: 竞争情报监控系统 实现计划（SSOT）
status: draft
date: 2026-07-08
spec: 001-competitor-tracking
version: 3.0
---

**目标：** 交付 Next.js 15 单体应用——JWT 用户系统 + MySQL（Prisma）+ API Routes + Vercel Cron 采集 + AI 解读的竞争情报监控 MVP

**范围：**
- **In：** 用户注册/登录（JWT）+ 竞对 CRUD + 定时采集（Vercel Cron）+ AI 解读（Claude Haiku）+ 历史记录查看
- **Out：** 忘记密码/邮件重置、第三方 OAuth、多角色权限、实时告警推送、社媒抓取

**架构：** Next.js 15 App Router 单体（Prisma 5.x + **PostgreSQL**），JWT HS256 无状态鉴权（access token 24h + refresh token 7d，httpOnly cookie），Edge middleware 拦截受保护路由，Vercel Cron Jobs 按小时触发 /api/cron/collect，axios + cheerio + Playwright fallback 采集，@anthropic-ai/sdk LLM 解读。

**技术栈对照：**

| 组件 | v2（废弃）| v3（当前）|
|---|---|---|
| 后端框架 | Python FastAPI | Next.js 15 API Routes |
| ORM | SQLAlchemy 2.x | Prisma 5.x |
| 调度 | APScheduler 3.x | Vercel Cron Jobs |
| 采集 | requests + BS4 + Playwright | axios + cheerio + Playwright |
| 鉴权 | python-jose + passlib | jose + bcryptjs |
| AI SDK | anthropic Python | @anthropic-ai/sdk Node.js |
| 部署 | Python VPS + Vercel 分离 | Vercel 单体 |

**需遵守的不变量：**
1. **数据隐私**：所有 /api/competitors、/api/snapshots 查询必须按当前登录用户的 userId 过滤
2. **密码安全**：密码只存 bcrypt hash（factor 12），不落盘明文，不出现在日志
3. **无状态鉴权**：受保护路由由 Edge middleware 验证 JWT 并注入 x-user-id header；后端不维护会话存储

---

## 里程碑与节奏

| 里程碑 | 任务 | 状态 | 交付物 |
|---|---|---|---|
| M1：项目骨架 | T1、T2 | 已完成 | package.json、tsconfig.json、next.config.ts、tailwind、prisma/schema.prisma、.env.example、vercel.json、middleware.ts |
| M2：业务逻辑层 | T3 | 已完成 | lib/db.ts、lib/auth.ts、lib/scraper.ts、lib/llm.ts、lib/collect.ts |
| M3：API Routes | T4、T5 | 已完成 | app/api/auth/*、app/api/competitors/*、app/api/snapshots/*、app/api/cron/collect |
| M4：前端页面 | T6 | 未开始 | 登录/注册/竞对管理/历史记录页面 |
| M5：收尾与验证 | T7 | 未开始 | .gitignore 更新、npm run build 通过、V-001~V-005 验证 |

---

## 任务清单（SSOT）

### Task T1：项目骨架配置文件

- [x] **状态**：已完成

**交付物：**
- package.json（Next.js 15、Prisma、jose、bcryptjs、axios、cheerio、diff、@anthropic-ai/sdk）
- next.config.ts、tsconfig.json、tailwind.config.ts、postcss.config.mjs
- .env.example、vercel.json（Cron: 0 * * * *）

### Task T2：Prisma schema + middleware

- [x] **状态**：已完成

**交付物：**
- prisma/schema.prisma（User、Competitor、Snapshot 三表，MySQL provider）
- middleware.ts（Edge JWT 验证，matcher: /api/competitors/**、/api/snapshots/**）

### Task T3：lib/ 业务逻辑层

- [x] **状态**：已完成

**交付物：**
- lib/db.ts（Prisma Client 单例）
- lib/auth.ts（jose JWT 签发/验证，bcryptjs 密码 hash，cookie 配置）
- lib/scraper.ts（axios+cheerio 主采集，Playwright fallback，UA 轮换，域名级延迟，重试 3 次）
- lib/llm.ts（@anthropic-ai/sdk，Claude Haiku 4.5，change_type/summary/importance，失败降级）
- lib/collect.ts（collectAll，Promise.allSettled 并发，diff 为空不调 LLM）

### Task T4：API Routes（认证）

- [x] **状态**：已完成

**交付物：**
- app/api/auth/register/route.ts（POST，邮箱唯一校验，bcrypt hash）
- app/api/auth/login/route.ts（POST，httpOnly cookie 写入）
- app/api/auth/refresh/route.ts（POST，refresh token 验证）
- app/api/auth/logout/route.ts（POST，清除 cookie）
- app/api/auth/me/route.ts（GET，当前用户信息）

### Task T5：API Routes（业务）

- [x] **状态**：已完成

**交付物：**
- app/api/competitors/route.ts（GET + POST，userId 隔离）
- app/api/competitors/[id]/route.ts（GET + PUT + DELETE，userId 隔离）
- app/api/snapshots/route.ts（GET 列表，competitor_id 参数）
- app/api/snapshots/[id]/route.ts（GET 详情，userId 隔离）
- app/api/cron/collect/route.ts（GET，Bearer CRON_SECRET 鉴权）

### Task T6：前端页面

- [x] **状态**：已完成

**文件：**
- app/(auth)/login/page.tsx（登录表单）
- app/(auth)/register/page.tsx（注册表单）
- app/dashboard/competitors/page.tsx（竞对列表 + CRUD）
- app/dashboard/snapshots/[competitorId]/page.tsx（历史记录列表）
- app/dashboard/layout.tsx（鉴权守卫，未登录跳转 /login）

### Task T7：收尾与验证

- [x] **状态**：已完成

**步骤：**
1. 更新 .gitignore（排除 node_modules、.next、.env.local）
2. npm run build 通过，无 TypeScript 报错
3. npm run db:push 验证 Prisma schema 可同步到 MySQL
4. 本地启动 npm run dev，完成 AC-L01~AC-L07 用户认证验收
5. 手动触发 GET /api/cron/collect（携带 CRON_SECRET）验证采集流程
6. Vercel 部署，验证 Cron Jobs 触发（V-005）

---

## NEEDS CLARIFICATION

无阻断项。所有关键决策已在 design/design.md v3 中固化。
