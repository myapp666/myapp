---
title: 竞争情报监控系统 PRD
status: draft
version: 1.0
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
- **In / Out 边界**：In = 竞对 URL 配置 + 定时自动采集 + AI 变化解读 + 历史记录查看；Out = 登录/鉴权、实时告警、社媒抓取、多角色权限
- **MVP 边界**：① `.env` 配置驱动（无后台管理页）② Python 后端采集 + FastAPI REST API ③ Next.js 前端部署到 Vercel（GitHub 推送自动部署）
- **推荐方案**：`.env` 驱动轻量服务——Python 后端（APScheduler + FastAPI）+ Next.js 前端（Vercel）；引用 `requirements/solution.md#推荐方案`
- **优先验证点**：V-001（AI 解读质量）、V-002（采集稳定性）

---

## 2. 范围与里程碑

### 2.1 MVP 范围（In / Out）

**In**：
- 竞对信息配置：通过 `.env` 的 `MONITOR_URLS` 管理监控 URL 列表；竞对字段：name、website_url、industry、notes
- Python 后端定时采集：按 `MONITOR_INTERVAL`（分钟）间隔，使用 requests+BeautifulSoup4 抓取 HTML；JS 渲染页面 fallback 到 Playwright；UA 轮换 + 域名级随机延迟（10–30s）
- AI 变化解读：调用 Claude Haiku 4.5（`AI_API_KEY`），对比前后快照，输出结构化 JSON（change_type / summary / importance）
- 数据存储：SQLite（WAL 模式）+ Alembic 迁移，`crawled_at` 加索引；仅 Python 后端写入
- REST API：FastAPI 暴露查询接口（`GET /api/snapshots`、`GET /api/urls`）；与 APScheduler 同进程运行
- 前端展示：Next.js 历史记录页，按 URL 下拉筛选 + 时间倒序列表 + 单条详情查看；通过 `NEXT_PUBLIC_API_BASE_URL` 调用后端
- 部署： 子目录部署到 Vercel（GitHub push 自动触发）；`backend/` 独立运行（本地/VPS）；根目录 `vercel.json` 配置路由

**Out**：
- 用户登录/鉴权/多角色权限
- 实时告警推送（Slack/邮件）
- 情报收件箱与协作标注
- 社媒抓取（Twitter/微博/App Store）
- 多模型路由/模型对比
- 代理池（MVP 阶段按需引入）

### 2.2 里程碑

| 里程碑 | 交付物 | 时间目标 |
|---|---|---|
| MVP 内测版 | 后端采集服务 + FastAPI + 前端 Vercel 可访问 | 开发启动后 2 周 |
| 内测验收 | V-001 / V-002 / V-003 / V-004 全部通过 | 内测第 2 周末 |
| v2（可选） | Slack 推送 + 多数据源 + 变化评分 | 2026-09 |

---

## 3. 核心场景

### 3.1 场景 S-001：运维配置监控目标

- **触发**：运维人员需要新增/修改/删除监控的竞对网站
- **参与者**：运维人员
- **目标**：通过编辑 `.env` 文件，在下一个采集周期内生效，全程无需修改代码或重新部署前端
- **成功标准**：
  1. 编辑 `MONITOR_URLS` 并重启后端服务后，新 URL 在下一个 `MONITOR_INTERVAL` 周期内出现采集记录
  2. 操作过程中无需开发人员介入
  3. 错误配置（非法 URL 格式）在后端日志中可见且不影响其他 URL 的正常采集

### 3.2 场景 S-002：定时采集与 AI 解读

- **触发**：APScheduler 按 `MONITOR_INTERVAL` 触发采集任务
- **参与者**：Python 后端（无人工干预）
- **目标**：自动抓取各 URL 的 HTML，与上次快照对比，若有变化则调用 LLM 生成结构化解读并存库
- **成功标准**：
  1. 每个 URL 每次调度最多触发一次采集（`max_instances=1`）
  2. 若页面有实质变化，AI 解读结果包含非空的 summary 字段
  3. 采集失败（网络超时/反爬）自动重试最多 3 次，失败记录写入日志但不中断其他 URL 采集

### 3.3 场景 S-003：查阅历史记录

- **触发**：PM/市场人员需要了解某竞对近期动向
- **参与者**：内部用户（通过 Vercel 访问前端）
- **目标**：在前端页面快速找到某竞对的历史变化记录，并查看 AI 解读详情
- **成功标准**：
  1. 从打开页面到找到目标竞对的最近一条记录，操作步骤不超过 3 步
  2. 单条记录展示：采集时间、change_type、summary、importance
  3. 用户在 2 分钟内完成"查找某竞对近 7 天变化"任务（对应 V-003）

---

## 4. 功能清单

| 功能项 | 优先级 | 里程碑 | 说明/依赖 |
|---|---|---|---|
| `.env` 配置读取（MONITOR_URLS / MONITOR_INTERVAL / AI_API_KEY） | P0 / Must | MVP | Python 后端读取；APScheduler max_instances=1；tenacity 重试 |
| requests+BS4 HTML 采集 | P0 / Must | MVP | Playwright fallback for SPA |
| Claude Haiku 4.5 AI 变化解读 | P0 / Must | MVP | 结构化 JSON 输出；依赖 AI_API_KEY |
| SQLite WAL 存储 + Alembic 迁移 | P0 / Must | MVP | crawled_at 索引；Python 独占写入 |
| FastAPI REST API（/api/snapshots、/api/urls） | P0 / Must | MVP | 与 APScheduler 同进程；CORS 配置 |
| Next.js 历史记录页（URL 筛选 + 时间列表 + 详情） | P0 / Must | MVP | 通过 NEXT_PUBLIC_API_BASE_URL 调用 |
| Vercel 部署（GitHub push 触发） | P0 / Must | MVP | vercel.json 路由；frontend/ 子目录构建 |
| UA 轮换 + 域名级随机延迟 | P1 / Should | MVP | 基础反爬应对 |
| Playwright JS 渲染 fallback | P1 / Should | MVP | 仅 SPA 页面触发 |
| 采集失败日志 | P1 / Should | MVP | 便于运维排查 |
| Slack/邮件告警推送 | P2 / Could | v2 | MVP Out |
| 代理池 | P2 / Could | 按需 | V-002 不达标时引入 |

---

## 5. 业务规则与口径

- **规则-1：URL 去重**：`MONITOR_URLS` 中重复的 URL 只采集一次（后端去重处理）
- **规则-2：无变化不存库**：若 HTML diff 为空（内容完全一致），不调用 LLM，不写入新记录
- **规则-3：AI 解读失败降级**：LLM 调用失败（超时/API 错误）时，记录存库但 summary 字段标记为 `"[AI 解读失败，原因: {error}]"`，不丢失采集快照
- **规则-4：并发控制**：同一 URL 的采集任务 `max_instances=1`，上一轮未完成时跳过本轮触发
- **规则-5：前端只读**：Next.js 前端只通过 REST API 读取，不直接访问 SQLite；SQLite 仅 Python 进程写入

---

## 6. 验收标准（AC，可测试）

### 6.1 场景 S-001 的 AC（运维配置）

- **AC-001**：在 `.env` 中 `MONITOR_URLS` 添加新 URL，重启后端后，等待一个 `MONITOR_INTERVAL` 周期，数据库中出现该 URL 的采集记录
- **AC-002**：`MONITOR_URLS` 中填写非法 URL 格式时，后端日志输出错误信息，其他合法 URL 的采集不受影响
- **AC-003**：由非开发人员按操作文档完成新增 URL 操作，全程无需开发介入（对应 V-004）

### 6.2 场景 S-002 的 AC（定时采集）

- **AC-004**：两次采集之间若目标页面无内容变化，数据库不新增记录（规则-2 生效）
- **AC-005**：目标页面有内容变化时，新记录的 `change_type` 字段非空，`summary` 字段为可读中文句子（对应 V-001）
- **AC-006**：单个 URL 采集超时（>30s）后自动重试，最多 3 次；重试耗尽后记录日志，不影响其他 URL 的同批次采集
- **AC-007**：连续运行 7 天，整体采集成功率 >90%（对应 V-002）

### 6.3 场景 S-003 的 AC（历史查阅）

- **AC-008**：前端页面加载后展示 `MONITOR_URLS` 中所有 URL 的下拉列表；选中某 URL 后，显示该 URL 的历史记录列表，按 `crawled_at` 倒序排列
- **AC-009**：单条记录展示字段：采集时间（格式 YYYY-MM-DD HH:mm）、change_type（标签样式）、summary（截断 200 字）、importance（低/中/高）
- **AC-010**：用户从打开页面到找到目标竞对最近一条记录，操作步骤不超过 3 步（对应 V-003）

---

## 7. 异常与边界

- **异常-1：HTML 采集超时（>30s）**：自动重试最多 3 次（tenacity 指数退避），重试耗尽后写日志，不中断其他 URL 的同批次采集（AC-006）
- **异常-2：LLM API 调用失败**：记录存库，summary 标记 [AI 解读失败]，不丢失采集快照（规则-3）
- **异常-3：重复 URL**：后端去重处理，只采集一次（规则-1）
- **异常-4：Vercel 环境变量未配置**：NEXT_PUBLIC_API_BASE_URL 为空时，前端展示"配置缺失"提示
- **异常-5：目标网站返回非 200**：记录 HTTP 状态码到日志，该次采集标记为失败，进入重试逻辑（AC-006）

---

## 8. 风险/依赖与验证清单

| 风险/假设/依赖 | 验证信号 | 方法 | Owner | 截止 | 触发动作 |
|---|---|---|---|---|---|
| V-001：Haiku 4.5 对 HTML diff 语义解读质量达标 | 80%+ 变化被正确识别，summary 有参考价值 | 人工选 3–5 个已知有变化页面，对比 AI 输出与人工判断 | 开发 + PM | 内测第 1 周 | 不达标：升级至 Sonnet 4.6 或调整 prompt 策略 |
| V-002：定时采集稳定性（>90% 成功率） | 7 天连续运行，成功率 >90% | 部署后统计每个 URL 的采集成功/失败次数 | 开发 | 内测第 2 周 | 不达标：引入代理池或降低 MONITOR_INTERVAL |
| V-003：前端用户体验（2 分钟内完成查阅） | 所有内测用户在 2 分钟内完成任务 | 邀请 2–3 位内测用户完成指定查阅任务，记录时长 | PM | 内测第 2 周 | 不达标：优化前端布局与信息层级 |
| V-004：`.env` 配置可维护性 | 非开发人员按文档独立完成新增 URL 操作 | 由运维按操作文档新增 1 个 URL，验证下一周期正确采集 | 开发（提供文档）+ 运维 | 内测第 1 周 | 不达标：改写配置说明文档或增加简单配置 UI |
| 依赖：Vercel 账号与 GitHub 仓库连接 | frontend/ 子目录构建成功，HTTPS 可访问 | 首次部署前在 Vercel Dashboard 完成 GitHub 连接与 Root Directory 配置 | 开发 | MVP 部署前 | 失败：检查 vercel.json 路由配置与构建命令 |
| 依赖：Anthropic API Key 可用额度 | API 调用返回 200，解读结果非空 | 部署前验证 AI_API_KEY 有效，预估月用量（按采集频率和 URL 数量） | 开发 | MVP 部署前 | 不可用：补充额度或临时降低采集频率 |

---

## 9. 原型产出判定

- **交互变化结论**：有，但相对简单——新增历史记录列表页（URL 筛选 + 时间列表 + 单条详情）；无复杂状态分支，无需单独原型，AC 已足够指导实现
- **页面与入口**：新增 `/monitor` 路由（Next.js）；现有 landing page 保留根目录不变；`vercel.json` 配置 `/monitor` 路由指向 `frontend/` 构建产物
- **关键控件/字段与校验**：
  - URL 下拉选择器：选项来自 `GET /api/urls`；默认选中第一项
  - 历史记录列表：`crawled_at` 倒序；每页 20 条；无分页时显示"暂无记录"
  - 单条记录字段：`crawled_at`（格式化）、`change_type`（标签）、`summary`（截断 200 字）、`importance`（低/中/高）

---

## 10. 追溯链接

- `requirements/solution.md`：推荐方案（`.env` 驱动轻量服务）、验证清单 V-001~V-004、Impact Analysis
- `requirements/raw.md`：第 1–7 轮澄清记录（技术栈/字段/配置管理/功能扩展决策）
- `design/research.md`：T1（LLM 选型）、T2（APScheduler）、T3（requests+BS4）、T4（SQLite WAL）、T5（FastAPI REST API）、T6（Vercel+GitHub 部署）
- 术语与口径：无 `project/memory/glossary.md`（CONTEXT GAP，不阻断）
