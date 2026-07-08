---
title: 竞争情报监控系统 PRD
status: draft
version: 3.0
last_updated: 2026-07-07
---

# 竞争情报监控系统 PRD

> 目的：把 `requirements/solution.md` 的推荐决策转为可交付规格。不写"待确认问题"；未知统一写入第 8 节验证清单。

## 0. 基本信息

- 需求标识（分支 / ID）：`001-competitor-tracking`
- 作者：产品团队
- 评审人：开发 + 运维
- 状态：draft
- 最后更新：2026-07-07
- 关联链接：`requirements/solution.md`、`design/research.md`

---

## 1. 结论摘要

- **目标**：构建自动化竞争情报监控系统，替代人工浏览/截图/比对的低效工作流
- **In / Out 边界**：In = 用户注册/登录/JWT 鉴权 + 按用户隔离的竞对配置（SQLite）+ 定时自动采集 + AI 变化解读 + 历史记录查看；Out = 忘记密码/邮件重置、第三方 OAuth、多角色权限、实时告警、社媒抓取
- **MVP 边界**：① 用户登录（邮箱+密码，JWT 鉴权）② SQLite 承载用户账号与按用户隔离的竞对配置 ③ Python 后端采集 + FastAPI REST API ④ Next.js 前端部署到 Vercel（GitHub 推送自动部署）
- **推荐方案**：SQLite + JWT 鉴权轻量服务——Python 后端（APScheduler + FastAPI + JWT 鉴权）+ Next.js 前端（Vercel）；引用 `requirements/solution.md#推荐方案`
- **优先验证点**：V-001（AI 解读质量）、V-002（采集稳定性）、V-005（快照存储方案裁决）、V-006（JWT secret 安全）

---

## 2. 范围与里程碑

### 2.1 MVP 范围（In / Out）

**In**：
- **用户认证**：邮箱+密码注册/登录（任意邮箱开放注册，无域名白名单/邀请码）；JWT（access token 有效期 24h）+ refresh token（7 天）；需登录才能访问历史记录页与 API 接口
- **竞对信息配置**：登录用户通过前端页面自助添加/管理竞对（name、website_url、industry、notes），存入 SQLite，关联 `user_id`；不同用户各自维护独立列表，互不可见
- Python 后端定时采集：按 `.env` 的 `MONITOR_INTERVAL`（分钟，全局配置）间隔，汇总所有用户的竞对配置后抓取 HTML（requests+BeautifulSoup4）；JS 渲染页面 fallback 到 Playwright；UA 轮换 + 域名级随机延迟（10–30s）
- AI 变化解读：调用 Claude Haiku 4.5（`.env` 的 `AI_API_KEY`，全局配置），对比前后快照，输出结构化 JSON（change_type / summary / importance）
- 数据存储：SQLite 承载用户账号表 + 竞对配置表（`user_id` 外键）；采集快照存储方式（SQLite 或 JSON 文件 + filelock）由设计阶段裁决（对应 V-005）
- REST API：FastAPI 暴露查询接口（`GET /api/snapshots`、`GET /api/urls`，均按当前登录用户过滤）；竞对配置管理接口（`POST/GET/PUT/DELETE /api/competitors`）；认证接口（`POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`）；与 APScheduler 同进程运行；受保护接口需携带 Bearer token
- 前端展示：Next.js 历史记录页（需登录）+ 竞对配置管理页，含登录页（`/login`）+ 注册页（`/register`）；通过 `NEXT_PUBLIC_API_BASE_URL` 调用后端
- 部署：子目录部署到 Vercel（GitHub push 自动触发）；`backend/` 独立运行（本地/VPS）；根目录 `vercel.json` 配置路由

**Out**：
- 忘记密码/邮件重置密码（MVP 人工干预：数据库手动重置）
- 多角色权限（管理员/普通用户分离）
- 第三方 OAuth 登录（Google/GitHub）
- 实时告警推送（Slack/邮件）
- 情报收件箱与协作标注
- 社媒抓取（Twitter/微博/App Store）
- 多模型路由/模型对比
- 代理池（MVP 阶段按需引入）

### 2.2 里程碑

| 里程碑 | 交付物 | 时间目标 |
|---|---|---|
| MVP 内测版 | 后端采集服务 + FastAPI + 前端 Vercel 可访问 | 开发启动后 2 周 |
| 内测验收 | V-001 / V-002 / V-003 / V-004 / V-005 / V-006 全部通过 | 内测第 2 周末 |
| v2（可选） | Slack 推送 + 忘记密码 + 多数据源 + 变化评分 | 2026-09 |

---

## 3. 核心场景

### 3.0 场景 S-000：用户注册与登录

- **触发**：新用户首次访问系统，或已有用户需要重新认证
- **参与者**：内部用户（PM / 市场人员 / 运维）
- **目标**：通过邮箱+密码完成身份验证，获取访问权限后进入历史记录页
- **成功标准**：
  1. 未登录用户访问 `/monitor` 时，自动重定向到 `/login`
  2. 注册时邮箱已存在，前端展示"该邮箱已注册"错误提示
  3. 登录成功后跳转到 `/monitor`，token 存储在 httpOnly cookie 或 localStorage
  4. token 过期后，自动用 refresh token 静默续期；refresh token 也过期时，跳转到 `/login`

### 3.1 场景 S-001：用户自助管理竞对配置

- **触发**：登录用户需要新增/修改/删除自己监控的竞对网站
- **参与者**：登录用户（PM / 市场人员 / 运维）
- **目标**：通过前端页面提交竞对配置，在下一个采集周期内生效，全程无需开发人员介入或修改 `.env`
- **成功标准**：
  1. 通过 `POST /api/competitors` 添加新竞对后，等待一个 `MONITOR_INTERVAL` 周期，该竞对出现采集记录
  2. 操作过程中无需开发人员介入，也无需重启后端服务
  3. 提交非法 URL 格式时，前端/后端校验拒绝，返回明确错误提示，不写入数据库
  4. 用户只能查看/修改/删除自己添加的竞对，无法操作其他用户的竞对配置

### 3.2 场景 S-002：定时采集与 AI 解读

- **触发**：APScheduler 按 `.env` 的 `MONITOR_INTERVAL`（全局配置）触发采集任务
- **参与者**：Python 后端（无人工干预）
- **目标**：汇总所有用户的竞对配置，自动抓取各 URL 的 HTML，与上次快照对比，若有变化则调用 LLM 生成结构化解读并存库
- **成功标准**：
  1. 每个竞对 URL 每次调度最多触发一次采集（`max_instances=1`）
  2. 若页面有实质变化，AI 解读结果包含非空的 summary 字段
  3. 采集失败（网络超时/反爬）自动重试最多 3 次，失败记录写入日志但不中断其他 URL 采集
  4. 采集结果正确关联到所属竞对配置及其 `user_id`，不发生用户间数据串号

### 3.3 场景 S-003：查阅历史记录

- **触发**：PM/市场人员需要了解某竞对近期动向
- **参与者**：登录用户（通过 Vercel 访问前端）
- **目标**：在前端页面快速找到自己配置的某竞对的历史变化记录，并查看 AI 解读详情
- **成功标准**：
  1. 从打开页面到找到目标竞对的最近一条记录，操作步骤不超过 3 步
  2. 单条记录展示：采集时间、change_type、summary、importance
  3. 用户在 2 分钟内完成"查找某竞对近 7 天变化"任务（对应 V-003）

---

## 4. 功能清单

| 功能项 | 优先级 | 里程碑 | 说明/依赖 |
|---|---|---|---|
| 用户注册（邮箱+密码） | P0 / Must | MVP | `POST /auth/register`；密码 bcrypt hash；邮箱唯一索引；任意邮箱开放注册 |
| 用户登录（邮箱+密码） | P0 / Must | MVP | `POST /auth/login`；返回 JWT access token + refresh token |
| JWT 鉴权中间件（FastAPI Depends） | P0 / Must | MVP | Bearer token 验证；受保护接口统一注入；access token 24h |
| refresh token 自动续期 | P0 / Must | MVP | `POST /auth/refresh`；refresh token 7 天；前端静默调用 |
| 前端登录页（/login）与注册页（/register） | P0 / Must | MVP | 未登录重定向；登录成功跳转 /monitor |
| 前端认证状态管理（token 存储与过期处理） | P0 / Must | MVP | 推荐 httpOnly cookie（SSR 兼容）或 localStorage + axios interceptor |
| SQLite 用户账号表 + 竞对配置表 | P0 / Must | MVP | 竞对配置表带 `user_id` 外键；替代原 `.env` 的 `MONITOR_URLS` |
| 竞对配置管理接口（/api/competitors CRUD） | P0 / Must | MVP | 按登录用户过滤；仅本人可增删改查 |
| 前端竞对配置管理页 | P0 / Must | MVP | 需登录态；表单校验 URL 格式 |
| `.env` 全局配置读取（MONITOR_INTERVAL / AI_API_KEY） | P0 / Must | MVP | Python 后端读取；APScheduler max_instances=1；tenacity 重试 |
| requests+BS4 HTML 采集 | P0 / Must | MVP | Playwright fallback for SPA；抓取对象来自 SQLite 竞对配置汇总 |
| Claude Haiku 4.5 AI 变化解读 | P0 / Must | MVP | 结构化 JSON 输出；依赖 AI_API_KEY |
| 采集快照存储（方式待设计阶段裁决） | P0 / Must | MVP | SQLite 或 JSON 文件 + filelock；对应 V-005 |
| FastAPI REST API（/api/snapshots、/api/urls） | P0 / Must | MVP | 与 APScheduler 同进程；CORS 配置；按 user_id 过滤；受保护接口需 Bearer token |
| Next.js 历史记录页（竞对筛选 + 时间列表 + 详情） | P0 / Must | MVP | 需登录态；仅展示当前用户竞对；通过 NEXT_PUBLIC_API_BASE_URL 调用 |
| Vercel 部署（GitHub push 触发） | P0 / Must | MVP | vercel.json 路由；frontend/ 子目录构建 |
| UA 轮换 + 域名级随机延迟 | P1 / Should | MVP | 基础反爬应对 |
| Playwright JS 渲染 fallback | P1 / Should | MVP | 仅 SPA 页面触发 |
| 采集失败日志 | P1 / Should | MVP | 便于运维排查 |
| Slack/邮件告警推送 | P2 / Could | v2 | MVP Out |
| 代理池 | P2 / Could | 按需 | V-002 不达标时引入 |

---

## 5. 业务规则与口径

- **规则-0：接口鉴权**：`/api/snapshots`、`/api/urls`、`/api/competitors` 等业务接口需携带有效 Bearer token；无 token 或 token 无效返回 HTTP 401；`/auth/*` 接口公开
- **规则-0a：密码存储**：密码只存 bcrypt hash（cost factor ≥ 12），明文密码不落盘、不出现在日志
- **规则-0b：注册限制**：同一邮箱只能注册一次；注册时不自动登录，需用户主动登录
- **规则-0c：数据隔离**：竞对配置与历史记录均按 `user_id` 隔离；用户只能访问自己拥有的数据，跨用户访问返回 HTTP 403 或空结果
- **规则-1：URL 去重**：同一用户下重复添加相同 URL 时，后端拒绝并提示"该竞对已存在"（去重范围限定在单用户内，不同用户可监控相同 URL）
- **规则-2：无变化不存库**：若 HTML diff 为空（内容完全一致），不调用 LLM，不写入新记录
- **规则-3：AI 解读失败降级**：LLM 调用失败（超时/API 错误）时，记录存库但 summary 字段标记为 `"[AI 解读失败，原因: {error}]"`，不丢失采集快照
- **规则-4：并发控制**：同一竞对 URL 的采集任务 `max_instances=1`，上一轮未完成时跳过本轮触发
- **规则-5：前端只读**：Next.js 前端只通过 REST API 读取，不直接访问数据库；数据写入仅通过 Python 后端 API

---

## 6. 验收标准（AC，可测试）

### 6.0 场景 S-000 的 AC（用户注册与登录）

- **AC-L01**：POST `/auth/register` 传入合法邮箱+密码（≥8 位），返回 HTTP 201；再次以相同邮箱注册，返回 HTTP 409 并含错误字段 `"email already exists"`
- **AC-L02**：POST `/auth/login` 传入正确邮箱+密码，返回 HTTP 200，body 包含 `access_token`（JWT，24h）和 `refresh_token`（7 天）
- **AC-L03**：POST `/auth/login` 传入错误密码，返回 HTTP 401，body 不泄露"密码错误"或"邮箱不存在"的区分信息（统一返回"邮箱或密码错误"）
- **AC-L04**：携带有效 access token 访问 `GET /api/urls`，返回 HTTP 200；无 token 或 token 过期，返回 HTTP 401
- **AC-L05**：access token 过期后，前端自动调用 `POST /auth/refresh` 携带 refresh token，获取新 access token，原请求无感重试成功
- **AC-L06**：前端未登录用户直接访问 `/monitor`，自动重定向到 `/login`；登录成功后跳转回 `/monitor`
- **AC-L07**：注册页提交时邮箱格式非法（缺少 @），前端立即展示"邮箱格式不正确"，不发起网络请求

### 6.1 场景 S-001 的 AC（用户自助管理竞对配置）

- **AC-001**：登录用户调用 `POST /api/competitors` 提交合法竞对信息，返回 HTTP 201；等待一个 `MONITOR_INTERVAL` 周期后，该竞对出现采集记录
- **AC-002**：提交非法 URL 格式（如缺少协议头）时，返回 HTTP 422，body 含字段级错误提示；不写入数据库，不影响其他竞对采集
- **AC-003**：由非开发人员按操作文档完成新增竞对操作，全程无需开发介入（对应 V-004）
- **AC-011**：用户 A 调用 `GET /api/competitors` 只返回自己添加的竞对列表，不包含用户 B 的竞对；用户 A 尝试 `DELETE` 用户 B 的竞对 ID，返回 HTTP 403 或 404

### 6.2 场景 S-002 的 AC（定时采集）

- **AC-004**：两次采集之间若目标页面无内容变化，数据库不新增记录（规则-2 生效）
- **AC-005**：目标页面有内容变化时，新记录的 `change_type` 字段非空，`summary` 字段为可读中文句子（对应 V-001）
- **AC-006**：单个 URL 采集超时（>30s）后自动重试，最多 3 次；重试耗尽后记录日志，不影响其他 URL 的同批次采集
- **AC-007**：连续运行 7 天，整体采集成功率 >90%（对应 V-002）

### 6.3 场景 S-003 的 AC（历史查阅）

- **AC-008**：前端页面加载后展示当前登录用户 `GET /api/competitors` 返回的竞对下拉列表；选中某竞对后，显示该竞对的历史记录列表，按 `crawled_at` 倒序排列
- **AC-009**：单条记录展示字段：采集时间（格式 YYYY-MM-DD HH:mm）、change_type（标签样式）、summary（截断 200 字）、importance（低/中/高）
- **AC-010**：用户从打开页面到找到目标竞对最近一条记录，操作步骤不超过 3 步（对应 V-003）

---

## 7. 异常与边界

- **异常-0：无效/过期 token**：返回 HTTP 401，前端跳转 `/login`（AC-L04）
- **异常-0a：refresh token 过期**：前端跳转 `/login`，用户重新登录（AC-L05）
- **异常-0b：连续登录失败**：MVP 阶段不实现账号锁定；后端日志记录失败次数（v2 可加速率限制）
- **异常-1：HTML 采集超时（>30s）**：自动重试最多 3 次（tenacity 指数退避），重试耗尽后写日志，不中断其他 URL 的同批次采集（AC-006）
- **异常-2：LLM API 调用失败**：记录存库，summary 标记 [AI 解读失败]，不丢失采集快照（规则-3）
- **异常-3：同用户重复 URL**：后端拒绝并提示"该竞对已存在"（规则-1）
- **异常-3a：跨用户访问越权**：请求的竞对/记录不属于当前 token 对应的用户，返回 HTTP 403 或 404（规则-0c）
- **异常-4：Vercel 环境变量未配置**：NEXT_PUBLIC_API_BASE_URL 为空时，前端展示"配置缺失"提示
- **异常-5：目标网站返回非 200**：记录 HTTP 状态码到日志，该次采集标记为失败，进入重试逻辑（AC-006）

---

## 8. 风险/依赖与验证清单

| 风险/假设/依赖 | 验证信号 | 方法 | Owner | 截止 | 触发动作 |
|---|---|---|---|---|---|
| V-001：Haiku 4.5 对 HTML diff 语义解读质量达标 | 80%+ 变化被正确识别，summary 有参考价值 | 人工选 3–5 个已知有变化页面，对比 AI 输出与人工判断 | 开发 + PM | 内测第 1 周 | 不达标：升级至 Sonnet 4.6 或调整 prompt 策略 |
| V-002：定时采集稳定性（>90% 成功率） | 7 天连续运行，成功率 >90% | 部署后统计每个 URL 的采集成功/失败次数 | 开发 | 内测第 2 周 | 不达标：引入代理池或降低 MONITOR_INTERVAL |
| V-003：前端用户体验（2 分钟内完成查阅） | 所有内测用户在 2 分钟内完成任务 | 邀请 2–3 位内测用户完成指定查阅任务，记录时长 | PM | 内测第 2 周 | 不达标：优化前端布局与信息层级 |
| V-004：竞对配置可维护性（用户自助） | 非开发人员登录后独立完成新增竞对操作 | 由运维登录后通过前端新增 1 个竞对，验证下一周期正确采集 | 开发（提供文档）+ 运维 | 内测第 1 周 | 不达标：改写操作说明文档或简化表单交互 |
| V-005：采集快照存储方案裁决 | 设计阶段产出明确结论并写入 design.md | 评估 SQLite vs JSON 文件 + filelock 在按 user_id 查询性能、并发写入安全性上的差异 | 开发 | 设计阶段（D 链路）完成前 | 若未决：默认沿用 JSON 文件 + filelock，按 user_id 分目录存储 |
| V-006：JWT secret 管理与 token 存储安全 | 代码审查通过，无高危发现 | 审查 secret 来源与强度（≥32 字节随机串，来自 `.env`）；审查前端 token 存储方式 | 开发 | MVP 部署前 | 不达标：改用 httpOnly cookie 存储 token |
| 依赖：Vercel 账号与 GitHub 仓库连接 | frontend/ 子目录构建成功，HTTPS 可访问 | 首次部署前在 Vercel Dashboard 完成 GitHub 连接与 Root Directory 配置 | 开发 | MVP 部署前 | 失败：检查 vercel.json 路由配置与构建命令 |
| 依赖：Anthropic API Key 可用额度 | API 调用返回 200，解读结果非空 | 部署前验证 AI_API_KEY 有效，预估月用量（按采集频率和用户竞对总数） | 开发 | MVP 部署前 | 不可用：补充额度或临时降低采集频率 |

---

## 9. 原型产出判定

- **交互变化结论**：有——新增用户登录页（`/login`）+ 注册页（`/register`）+ 竞对配置管理页（`/monitor/competitors`）+ 历史记录列表页（`/monitor`，均需登录）；认证流程与用户自助配置流程有状态跳转，AC 已足够指导实现
- **页面与入口**：
  - `/login`：邮箱+密码表单，登录成功跳转 `/monitor`
  - `/register`：邮箱+密码+确认密码表单，注册成功提示"注册成功，请登录"并跳转 `/login`
  - `/monitor/competitors`：需登录态；竞对增删改表单 + 列表（仅展示当前用户竞对）
  - `/monitor`：需登录态；未登录重定向 `/login`；现有 landing page 保留根目录不变
- **关键控件/字段与校验**：
  - 登录/注册表单：邮箱格式前端校验；密码 ≥8 位；提交中禁用按钮防重复提交
  - 竞对配置表单：name/website_url（URL 格式校验）/industry/notes；提交后前端列表即时刷新
  - 竞对下拉选择器：选项来自 `GET /api/competitors`（需 token，按当前用户过滤）；默认选中第一项
  - 历史记录列表：`crawled_at` 倒序；每页 20 条；无分页时显示"暂无记录"
  - 单条记录字段：`crawled_at`（格式化）、`change_type`（标签）、`summary`（截断 200 字）、`importance`（低/中/高）

---

## 10. 追溯链接

- `requirements/solution.md`：推荐方案 v3.0（SQLite + JWT 鉴权轻量服务）、验证清单 V-001~V-006、Impact Analysis；与本 PRD v3.0 已同步 In/Out 边界
- `requirements/raw.md`：第 1–13 轮澄清记录（技术栈/字段/配置管理/功能扩展/用户登录/数据隔离/存储方案决策）
- `design/research.md`：T1（LLM 选型）、T2（APScheduler）、T3（requests+BS4）、T4（JSON 文件 + filelock，快照存储候选方案之一）、T5（FastAPI REST API）、T6（Vercel+GitHub 部署）
- 术语与口径：无 `project/memory/glossary.md`（CONTEXT GAP，不阻断）
