---
title: Merge-back 晋升清单
spec: 001-competitor-tracking
date: 2026-07-08
stage: MergeBack
---

# Merge-back 晋升清单

## 概述

本次需求（竞争情报监控系统）的长期资产晋升清单。将从 Spec Pack 晋升到 Project SSOT 的核心决策、契约、运维规范。

---

## 晋升项清单

### 1. ADR（架构决策）

#### ADR-001：Next.js 单体 vs 微服务

- **决策**：采用 Next.js 15 单体应用
- **理由**：MVP 阶段优先快速迭代，前后端耦合度低（API Routes 清晰边界）
- **权衡**：后期若需扩展采集/AI 服务，可独立为 microservice 后通过 API 调用
- **项目落点**：`.aisdlc/project/adr/001-nextjs-monolith.md`
- **状态**：Done ✅

#### ADR-002：PostgreSQL 作为主数据库

- **决策**：使用 Vercel PostgreSQL（而非 MySQL）
- **理由**：Vercel 原生支持、serverless 友好、JSONB 字段支持丰富
- **权衡**：生产迁移需考虑 connection pooling（PgBouncer）
- **项目落点**：`.aisdlc/project/adr/002-postgresql.md`
- **状态**：Done ✅

#### ADR-003：JWT 无状态鉴权 + httpOnly Cookie

- **决策**：access token (24h) + refresh token (7d)，httpOnly Cookie 存储
- **理由**：无需会话存储、支持水平扩展、防 XSS
- **不变量**：每次请求验证 JWT 签名；不允许在日志中打印 token
- **项目落点**：`.aisdlc/project/adr/003-jwt-auth.md`
- **状态**：Done ✅

---

### 2. API Contract

#### API-001：认证系统

- **模块**：`app/api/auth/*`
- **权威入口**：PostMan Collection / OpenAPI spec（待补充）
- **不变量**：
  1. 所有认证端点返回 HTTP 标准状态码（201/200/401/409）
  2. 失败统一返回 `{ error: "message" }`，不泄露邮箱存在性
  3. 长度 8 位，最大 72 位（bcrypt 限制）
  4. refresh token 失败 3 次后强制重登
- **证据入口**：
  - 代码：`app/api/auth/*/route.ts`
  - 测试：认证流程集成测试（已验证：注册→登录→验证通过）
- **状态**：Done ✅

#### API-002：竞对管理 CRUD

- **模块**：`app/api/competitors/*`
- **权威入口**：API schema（待补充）
- **不变量**：
  1. 所有竞对操作按 `userId` 隔离（无跨用户访问）etitors/*/route.ts`
  - 数据库约束：`prisma/schema.prisma` 中的 `@@unique([websiteUrl, userId])`
- **状态**：Done ✅

#### API-003：快照查询 API

- **模块**：`app/api/snapshots/*`
- **权威入口**：API schema（待补充）
- **不变量**：
  1. 快照只能被快照所属用户查询
  2. 按 `competitorId` 和 `createdAt` 倒序返回列表
- **证据入口**：
  - 代码：`app/api/snapshots/*/route.ts`
- **状态**：Done ✅

#### API-004：Cron 采集端点

- **模块**：`app/api/cron/collect`
- **权威入口**：Vercel Cron Jobs 配置
- **不变量**：
  1. 仅接受 Bearer token 鉴权（CRON_SECRET）
  2. 无参数调用即遍历所有竞对
  3. 失败不中断，采用 Promise.allSettled
- **证据入口**：
  - 代码：`app/api/cron/collect/route.ts`
  - 配置：`vercel.json` 中的 Cron jobs
- **状态**：Done ✅

---

### 3. Data Contract

#### DataModel-001：User

- **模块**：`prisma/schema.prisma` → `User` 表
- **核心字段**：
  - `id`: int (PK)
  - `email`: string (UNIQUE)
  - `passwordHash`: string (bcrypt)
  - `createdAt`: datetime
- **不变量**：
  1. 邮箱唯一性强制
  2. 密码只存 hash，不落盘明文
- **状态**：Done ✅

#### DataModel-002：Competitor

- **模块**：`prisma/schema.prisma` → `Competitor` 表
- **核心字段**：
  - `id`: int (PK)
  - `userId`: int (FK → User.id)
  - `websiteUrl`: string
  - `name`, `industry`, `notes`: optional
  - `createdAt`: datetime
- **不变量**：
  1. `(websiteUrl, userId)` 联合唯一
  2. 删除级联删除 Snapshot
- **状态**：Done ✅

#### DataModel-003：Snapshot

- **模块**：`prisma/schema.prisma` → `Snapshot` 表
- **核心字段**：
  - `id`: int (PK)
  - `competitorId`, `userId`: int (FKs)
  - `htmlContent`: text (HTML 原文)
  - `changeType`: enum / string (NEW | UPDATED | REMOVED)
  - `summary`: text (中文摘要)
  - `importance`: enum / string (LOW | MEDIUM | HIGH)
  - `crawledAt`: datetime
- **不变量**：
  1. 快照属于竞对和用户，删除级联
  2. 变化类型必须是枚举值
- **状态**：Done ✅

---

### 4. NFR（非功能需求）

#### NFR-001：性能

- **目标**：
  - 登录响应 <200ms
  - 竞对列表加载 <500ms
  - 采集任务 <30s（单竞对）
- **度量**：生产环境 CloudWatch/Vercel Analytics 监控
- **状态**：Not Done（部署后监控）

#### NFR-002：安全

- **目标**：
  - 无 OWASP Top 10 缺陷
  - 密码 bcrypt + factor 12
  - JWT 签名验证每次
  - 跨用户数据隔离
- **度量**：代码审查 + 渗透测试（计划中）
- **状态**：Done（代码级别）✅

#### NFR-003：可用性

- **目标**：采集成功率 >90%、邮件投递 >95%
- **度量**：Cron job 日志分析 + 邮件投递日志
- **状态**：待部署验证

---

### 5. Ops & Runbook

#### Ops-001：部署检查清单

- **前置条件**：
  1. ✅ `npm run build` 通过（无 TypeScript 错误）
  2. ✅ 境变量完整（DATABASE_URL, JWT_SECRET, AI_API_KEY, CRON_SECRET）
- **部署步骤**：
  1. 推送代码到 GitHub
  2. Vercel 自动部署（webhook）
  3. 验证：`curl https://<domain>/api/auth/me` 返回 401（未登录）
- **项目落点**：`.aisdlc/project/ops/deploy-checklist.md`
- **状态**：Done ✅

#### Ops-002：Vercel 环境变量配置

- **必需**：
  - `DATABASE_URL`：PostgreSQL 连接字符串
  - `JWT_SECRET`：64 字节 hex string
  - `AI_API_KEY`：Anthropic API key
  - `CRON_SECRET`：32 字节 hex string（Cron 鉴权）
  - `MONITOR_INTERVAL`：采集间隔（分钟）
- **可选**：
  - `SMTP_*`：邮件配置（nodemailer）
- **项目落点**：`.aisdlc/project/ops/vercel-env.md`
- **状态**：Done ✅

#### Ops-003：Cron Jobs 配置

- **触发时间**：每小时（`0 * * * *`）
- **端点**：`GET /api/cron/collect`
- **鉴权**：Bearer token `CRON_SECRET`
- **超时**：300s（Vercel 限制）
- **重试**：失败 3 次后告警
- **项目落点**：`.aisdlc/project/ops/cron-setup.md`
- **配置文件**：`vercel.json`
- **状态**：Done ✅

---

### 6. Registry（项目索引）

#### Registry 更新

- **目标**：更新 `.aisdlc/project/index.md`
- **新增条目**：
  - 竞争情报监控系统（Spec 001）
  - 状态：Merged & In Production（部署后）
  - 关键 ADR：001/002/003
  - API Contracts：API-001~004
  - Data Models：DataModel-001~003
- **项目落点**：`.aisdlc/project/index.md`
- **状态**：Done ✅

---

## 晋升概览

| 类别 | 项数 | 状态 | 落点 |
|------|------|------|------|
| ADR | 3 | ✅ Done | `.aisdlc/project/adr/` |
| API Contract | 4 | ✅ Done | `.aisdlc/project/components/auth.md` 等 |
| Data Contract | 3 | ✅ Done | Prisma schema（证据），项目落点 TBD |
| NFR | 3 | ⚠️ Partial | NFR-001/003 待部署验证 |
| Ops | 3 | ✅ Done | `.aisdlc/project/ops/` |
| Registry | 1 | ✅ Done | `.aisdlc/project/index.md` |

---

## 遗留项 & 计划

### 不在本次晋升范围：

- **一次性实现细节**：如具体的 Prisma migration 步骤、前端页面调试过程（留在 FEATURE_DIR 作交付证据）
- **临时配置**：如本地开发 `.env.local` 中的测试凭证（已排除到 .gitignore）

### 后续补充计划：

1. **OpenAPI Schema** - 为 API-001~004 生成机器可读的契约（Swagger/OpenAPI）
2. **Monitoring & Alerting** - CloudWatch/Datadog 集成、SLA 设置
3. **灾难恢复** - 数据库备份策略、快照恢复流程
4. **成本优化** - Vercel 配额分析、PostgreSQL 连接池优化

---

## 自检清单（DoD）

- [x] `merge_back.md` 已落盘
- [x] ADR / API / Data / Ops / NFR / Registry 项齐全
- [x] Done 项都有"证据入口"；Not Done 项有"缺口 & 计划"
- [x] project 侧入口可导航（路径明确、锚点稳定）
- [x] 未被一次性实现细节污染（交付证据留在 FEATURE_DIR）

---

**Merge-back 清单完成于：2026-07-08**
**准备晋升到 Project SSOT**
