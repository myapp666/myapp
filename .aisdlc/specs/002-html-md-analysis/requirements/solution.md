---
title: 产品需求方案决策（Solutionate）— 002-html-md-analysis
status: reviewing
---

> 目的：把"清洗 HTML 为 Markdown 后给 AI 分析"收敛为可评审决策，作为后续 plan/execute 的唯一决策入口。
>
> 简单需求快速通道：本文末附带 Mini-PRD，跳过独立的 `requirements/prd.md` 与 `requirements/prototype.md`（参见 §8 与原始需求澄清记录第 3–5 轮）。

## 0. 基本信息

- 需求标识（分支 / ID）：`002-html-md-analysis`
- 作者 / 参与评审：Spec 作者 + DEV
- 状态：reviewing
- 最后更新：2026-07-09
- 关联链接：
  - 原始需求：[requirements/raw.md](./raw.md)
  - 项目架构：[.aisdlc/project/adr/001-nextjs-monolith.md](../../project/adr/001-nextjs-monolith.md)
  - 项目 AI 约定参照：[lib/llm.ts](../../../lib/llm.ts)

## 1. 结论摘要（先给结论，3–7 行）

- **一句话目标**：在 Next.js 单体内提供 `lib/html.ts`，把任意来源的 HTML 字符串先清洗为 Markdown，再调用 Claude 输出结构化分析结果（`content_type` / `summary` / `importance`），供 001 及其他未来模块复用。
- **本次 In / Out 边界**：
  - **In**：新建 `lib/html.ts`；新增依赖 `turndown` + `@types/turndown`；调用 Anthropic SDK 走 `lib/llm.ts` 同款 env 约定；纯前端 lib，无后端 API、无 DB schema 变更。
  - **Out**：不抓 URL / 不读文件（IO 由调用方处理）；不分块、不流式；不引入 readability；不动 001 的 Python 后端与采集链路；不写新的 Next.js API Route。
- **推荐方案**：`cleanHtmlToMarkdown + analyzeHtml` 双函数（turndown + Anthropic SDK，输出严格 JSON，沿用 `lib/llm.ts` 的防御性解析）。
- **优先验证点**：V-001（turndown 异常输入行为）、V-002（AI 调用超时与字段缺失兜底）、V-003（截断策略对长 HTML 的影响）。

## 2. 推荐方案

- **方案名**：`lib/html.ts` 双函数模块（`cleanHtmlToMarkdown` + `analyzeHtml`）
- **主流程 / 关键机制**：
  1. 调用方把任意 HTML 来源（已抓取/已读文件/粘贴文本）转成字符串后传入 `cleanHtmlToMarkdown(html: string): string`
  2. 模块内部用 `TurndownService().turndown(html)` 转成 GFM Markdown；空字符串/非法输入返回空字符串而非抛异常
  3. 调用方把 Markdown 字符串 + 可选 `opts.prompt` 传入 `analyzeHtml(md: string, opts?): Promise<HtmlAnalysis>`（详见接口说明见 §8 Mini-PRD）
  4. 模块用 Anthropic SDK + 内置中文 prompt 模板调用 Claude，强制输出严格 JSON
  5. 用与 `lib/llm.ts` 同款的 `extractJson`（剥离 ```json 围栏、找最外层 `{...}`）兜底解析
  6. 字段缺失时按 `content_type=""` / `summary="[AI 解读失败]"` / `importance=""` 兜底返回，**不**抛异常
- **关键边界/取舍**：
  - **不入 URL/文件 IO**：保持模块纯函数特性，单测无需 mock fs/fetch；调用方自行负责 IO
  - **整篇一次性，不分块**：MVP 简化设计；超长输入走截断策略（V-003），分块与流式留待 v2
  - **不引入第二种清洗路径**：MVP 不上 readability；若 v2 出现文章正文提取需求，按 opts 开关扩展（V-004）
- **为什么选它**：
  - 证据：`raw.md` 澄清记录第 1–5 轮均明确锁定此方案
  - 约束对齐：与 ADR-001（Next.js 单体）+ `lib/llm.ts` 的 AI 调用约定一致
  - 验证可达：纯函数 + 类型导出，单测可覆盖所有异常路径（V-001/V-002）

## 3. 备选方案（2–3 个，差异明显）

### 3.1 备选方案：内置 Next.js API Route 后端化

- **核心机制**：把 `cleanHtmlToMarkdown` 与 `analyzeHtml` 暴露为 `/api/html/clean`、`/api/html/analyze` 两个 API Route；前端 fetch 调用
- **主流程**：
  1. 前端把 HTML 字符串 POST 到 `/api/html/analyze`
  2. 后端 Route 调 turndown + Anthropic SDK 返回 JSON
  3. 前端拿到 `HtmlAnalysis` 渲染
- **边界与取舍**：
  - `AI_API_KEY` 走服务端 env 更安全（不暴露给浏览器）
  - 增加网络往返；前端需处理 loading/error UI
  - 与 001 现有"前端直连 AI"惯例不一致（001 的 `lib/llm.ts` 也是前端模块）
- **适用前提**（何时会选它）：未来 AI Key 不能下发到浏览器、需统一后端代理计费/限流时
- **不选原因**：MVP 内 `AI_API_KEY` 已存在浏览器可读 env（`lib/llm.ts` 已如此）；引入 API Route 与现有架构风格不一致；增加无谓的网络层。

### 3.2 备选方案：`lib/html.ts` + readability 双清洗路径

- **核心机制**：模块同时引入 `@mozilla/readability` + `jsdom`，默认走 turndown，提供 `opts.readability=true` 切换到"先抽正文再转 MD"
- **主流程**：
  1. 调用方传 HTML + `opts.readability`
  2. 若 true：jsdom 解析 → Readability 抽正文 → turndown 转 MD
  3. 若 false：直接 turndown
- **边界与取舍**：
  - 对文章/博客类页面体验更干净（去除导航/广告/侧边栏）
  - 引入两个重依赖（jsdom ~数 MB、readability）；bundle 体积与冷启动成本上升
  - 双路径维护成本：两份 prompt 模板、两套兜底逻辑
- **适用前提**（何时会选它）：v2 出现大量文章正文提取场景且明显受益于 readability
- **不选原因**：MVP 不需要；澄清记录第 3 轮明确否决；体积成本不划算；可作 v2 增量（V-004）。

### 3.3 备选方案：作为 001-competitor-tracking 的内部子能力合并

- **核心机制**：把 `html.ts` 合并到 001 分支，复用 001 的 Python 后端做清洗与 AI 调用
- **主流程**：
  1. 用户在 001 竞对详情页上传 HTML 片段
  2. Python 后端用 BeautifulSoup/selectolax 清洗 + Claude API 解读
  3. 结果存 001 的 SQLite 快照表
- **边界与取舍**：
  - 与 001 既有 Python 链路天然集成
  - 但定位完全不同：001 是"竞对监控 + 自动采集"，002 是"通用 HTML → MD → AI"工具；强行合并会让 001 Spec Pack 范围膨胀
- **适用前提**（何时会选它）：本需求确实只服务 001 的"人工补充上传"场景
- **不选原因**：澄清记录第 1 轮明确"独立 Spec Pack"；HTML 字符串清洗本属前端 utils，不该下沉到 Python；复用边界清晰更有利于 v2 扩展到其他模块。

## 4. 决策依据（证据入口清单）

- `{FEATURE_DIR}/requirements/raw.md` 引用点位：
  - 澄清记录 第 1 轮：定位（独立 Spec Pack + 新建 `lib/html.ts`）+ AI 通道约定
  - 澄清记录 第 2 轮：输入契约（`string` 入参，无 IO）
  - 澄清记录 第 3 轮：清洗引擎（turndown）+ 目标 MD 风格（GFM 默认）
  - 澄清记录 第 4 轮：AI 契约（整篇 + 严格 JSON + 防御性解析）
  - 澄清记录 第 5 轮：JSON schema（`content_type` / `summary` / `importance`）
- 项目知识库/约束来源：
  - `.aisdlc/project/adr/001-nextjs-monolith.md`：Next.js 15 单体架构、Vercel 部署、TypeScript 约束
  - `lib/llm.ts`：Anthropic SDK + env 约定 + `extractJson` 防御性解析 + `ChangeAnalysis` 字段缺失兜底模式
- 若缺少证据：
  - 项目知识库 4 个核心文件（`memory/product.md` / `memory/glossary.md` / `products/index.md` / `components/index.md`）全部缺失 → 已落入 §7.4 Context Gaps + V-005

## 5. 验证清单（V-xxx，可执行）

- **V-001 turndown 异常输入行为**
  - 风险/假设：传入空字符串、纯文本（无标签）、含未闭合标签的 HTML 时，turndown 是否会抛异常或输出乱码
  - 方法：单测覆盖以下 5 类输入 — `""`、纯文本、`"<p>未闭合"`、`<script>...</script>` 内嵌、含 emoji 与中文长字符串
  - 成功/失败信号：5 类全部返回字符串（空字符串或合法 MD），不抛异常
  - Owner：DEV
  - 截止：实现完成后 1 天内
  - 触发动作：不成立则加 try/catch + 输入预校验（trim + 空字符串短路）

- **V-002 AI 调用异常与字段缺失兜底**
  - 风险/假设：网络错误 / SDK 抛错 / 模型超时 / 模型未输出 JSON / JSON 缺字段 时，模块行为是否符合预期
  - 方法：单测用 mock Anthropic SDK 模拟 5 类异常（throw / 超时 / 文本非 JSON / JSON 缺 content_type / JSON 缺 summary），断言返回的 `HtmlAnalysis` 字段值
  - 成功/失败信号：5 类异常均返回合法 `HtmlAnalysis` 对象（`content_type=""` / `summary="[AI 解读失败, 原因: ...]"` / `importance=""`），不向调用方抛错
  - Owner：DEV
  - 截止：实现完成后 1 天内
  - 触发动作：不成立则补 try/catch 并保证缺字段兜底与 `lib/llm.ts` 一致

- **V-003 超长输入截断策略**
  - 风险/假设：单次 AI 调用上下文超限（如 HTML 转为 MD 后 > 15000 字符）会被截断或报错
  - 方法：在 `analyzeHtml` 入口对 md 入参做 `slice(0, 15000)` + 截断提示追加到 prompt；单测断言截断生效且不破坏 JSON 输出
  - 成功/失败信号：超长输入（>15k 字符）返回合法 `HtmlAnalysis`，且 `summary` 反映"输入已截断"语义
  - Owner：DEV
  - 截止：实现完成后 2 天内
  - 触发动作：不成立则调整上限（8000 / 30000）并重新评估

- **V-004 v2 增量入口（readability 双路径）**
  - 风险/假设：v2 出现文章正文提取场景时，当前实现无法平滑扩展
  - 方法：本 MVP 实现中预留 `opts.readability?: boolean` 形参（不实现、仅签名），便于 v2 接入
  - 成功/失败信号：TS 类型校验通过；调用方传 `readability` 不会破坏现有行为（默认 false 走 turndown）
  - Owner：DEV
  - 截止：MVP 评审通过即可
  - 触发动作：v2 触发条件 = 出现 ≥ 1 个非 001 模块需要正文提取

- **V-005 项目知识库补齐**
  - 风险/假设：`.aisdlc/project/memory/product.md` / `glossary.md` / `products/index.md` / `components/index.md` 4 个文件全部缺失，影响后续 Spec Pack 的 Discover 与 Impact Analysis 质量
  - 方法：在后续 Spec Pack 中通过 `project-discover-preflight-scope` 触发 Delta Discover，至少补齐 `components/lib.md`（记录 `lib/html.ts` 这一新模块）
  - 成功/失败信号：`.aisdlc/project/components/lib.md` 存在并包含 `html.ts` 模块页（含 API 契约 + 调用方清单 + 证据入口）
  - Owner：Spec 作者 / Maintainer
  - 截止：本 Spec Pack Merge Back 阶段（参见 §7.4）
  - 触发动作：不成立则在 merge_back.md 显式登记缺口并安排后续 Spec Pack

- **V-006 与 `lib/llm.ts` 风格一致性 review**
  - 风险/假设：新模块若自定义 prompt 模板/JSON 解析/兜底策略，可能与 `lib/llm.ts` 分叉
  - 方法：CR 时逐项对照 `lib/llm.ts` 的 `PROMPT_TMPL` / `extractJson` / 字段缺失兜底，确保风格一致
  - 成功/失败信号：CR 通过，差异点全部解释清楚（业务差异可接受，实现差异需重构）
  - Owner：CR reviewer
  - 截止：实现完成后 CR 阶段
  - 触发动作：不成立则重构到与 `lib/llm.ts` 同款

## 6. 迭代记录（追加，不覆盖）

- 2026-07-09 v1.0（首版）：完成 5 轮澄清收敛；确定 turndown + Anthropic SDK + 三字段 JSON 方案；明确跳过 prd.md/prototype.md，附 Mini-PRD；登记 4 项项目知识库 Context Gap 与 6 项验证清单。
- 2026-07-09 v1.0（备注）：澄清过程中已锁定本轮全部决策，无 v0.x 中间版本。

## 7. Impact Analysis（需求影响分析）

### 7.1 受影响模块

| 模块 | 影响类型 | 关键不变量 | stale? |
|------|----------|-----------|--------|
| `lib/html.ts`（新建） | 新增能力 | 纯函数、无 IO、类型导出、字段缺失兜底；遵循 `lib/*.ts` 既有约定 | no（新文件） |
| `package.json` / `package-lock.json` | 新增依赖 | `turndown`（runtime）+ `@types/turndown`（dev）；其他依赖不变 | no |
| `lib/llm.ts` | 无影响 | 仅作为风格参照，不修改 | no |
| `lib/scraper.ts` | 无影响 | 002 不复用其抓取能力，模块边界隔离 | no |
| `lib/auth.ts` / `lib/db.ts` / `lib/mailer.ts` / `lib/collect.ts` | 无影响 | 与本 Spec 无关 | no |
| 001-competitor-tracking | 无影响 | 不复用 001 的数据模型与 Python 后端 | no |
| Next.js API Routes | 无新增 | 不在 MVP 范围新增 Route | no |
| Anthropic SDK / env 约定 | 复用既有 | 沿用 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` | no |

### 7.2 需遵守的不变量

- **Next.js 15 + TypeScript 单体架构**（来源：`.aisdlc/project/adr/001-nextjs-monolith.md`）：新模块必须 TS 化、可被 Next.js 编译消费
- **`lib/*.ts` 风格约定**（来源：现有 `lib/llm.ts` / `lib/scraper.ts`）：纯函数 + 类型显式导出 + 错误兜底返回合法结构体（不向调用方抛错）
- **Anthropic SDK + env 约定**（来源：`lib/llm.ts`）：客户端构造、env 读取、模型默认值（`claude-haiku-4-5-20251001`）须与 `lib/llm.ts` 同步
- **Vercel 部署兼容**（来源：ADR-001 + 用户记忆 `vercel-deployment-domain.md`）：新增依赖 `turndown` 必须在 Vercel Edge/Node 运行时可用；不得引入仅本地可用的 native 绑定

### 7.3 跨模块影响

- `lib/html.ts` → 调用方：未来任何模块（001 v2、其他 Spec Pack）可调用，调用方需自行处理 IO 与并发（MVP 不内置并发控制）
- `lib/html.ts` → `lib/llm.ts`：风格同步（CR 必查项），但**不**直接 import（避免循环依赖）
- `lib/html.ts` → `package.json`：依赖体积影响（turndown ~30KB minified，可接受）
- `lib/html.ts` → Anthropic 计费：每次 `analyzeHtml` 调用都会触发一次 messages.create；调用方需自负责任（不在 lib 内做限流）

### 7.4 Context Gaps

- `CONTEXT GAP`：`.aisdlc/project/memory/product.md` 不存在 → 无法消费"产品定位/北极星指标"约束 → 建议动作：后续通过 `project-discover-preflight-scope` 触发补齐
- `CONTEXT GAP`：`.aisdlc/project/memory/glossary.md` 不存在 → 无法消费"业务术语表"约束 → 建议动作：同 preflight scope 任务
- `CONTEXT GAP`：`.aisdlc/project/products/index.md` 不存在 → 无法定位本 Spec Pack 在产品矩阵中的归属 → 建议动作：MVP 阶段接受此缺口（澄清记录已说明本 lib 跨多个未来产品复用），但需在 merge_back 阶段补一份 `products/index.md` 入口
- `CONTEXT GAP`：`.aisdlc/project/components/index.md` 不存在 → 无法消费模块地图 → 建议动作：通过 `project-discover-modules-contracts` 在后续 Spec Pack 补齐 `components/lib.md`（V-005）

## 8. Mini-PRD（仅在跳过 `requirements/prd.md` 时必填）

### MVP 范围

**In**：
- 新建文件 `lib/html.ts`，导出以下符号：
  - `cleanHtmlToMarkdown(html: string): string` — turndown 转换；空字符串/非法输入返回 `""`
  - `analyzeHtml(markdown: string, opts?: { prompt?: string }): Promise<HtmlAnalysis>` — Anthropic SDK 调用 + 防御性 JSON 解析
  - `interface HtmlAnalysis { content_type: "文章" | "产品页" | "文档" | "营销页" | "其他"; summary: string; importance: "低" | "中" | "高"; }`
- 新增依赖：`turndown`（runtime）+ `@types/turndown`（dev）
- 内置中文 prompt 模板，约束输出 schema、约束中文、约束三个枚举值
- 字段缺失兜底：与 `lib/llm.ts` 的 `ChangeAnalysis` 风格一致
- 单测覆盖：turndown 异常输入（V-001）、AI 调用异常（V-002）、超长输入截断（V-003）

**Out**：
- 不读文件、不抓 URL、不持有任何 IO/异步副作用
- 不分块、不流式、不并发限流
- 不引入 `@mozilla/readability` / `jsdom` / 自定义正则剥离
- 不新增 Next.js API Route、不动数据库 schema、不动 001-competitor-tracking
- 不实现 v2 readability 双路径（仅预留 `opts.readability` 形参，参见 V-004）

### 验收标准（AC）

- AC-1：`cleanHtmlToMarkdown("<h1>Hello</h1><p>World</p>")` 返回 `"# Hello\n\nWorld"`（turndown 默认 GFM）
- AC-2：`cleanHtmlToMarkdown("")` 返回 `""`，不抛异常
- AC-3：`cleanHtmlToMarkdown("纯文本无标签")` 返回 `"纯文本无标签"`，不抛异常
- AC-4：`analyzeHtml` 在 Anthropic SDK mock 返回合法 JSON 时，返回字段完全匹配的 `HtmlAnalysis`
- AC-5：`analyzeHtml` 在 Anthropic SDK mock 抛错时，返回 `{ content_type: "", summary: "[AI 解读失败, 原因: ...]", importance: "" }`，不向调用方抛错
- AC-6：`analyzeHtml` 在 mock 返回缺 `summary` 字段的 JSON 时，返回 `summary=""` 兜底，其他字段正常填充
- AC-7：`analyzeHtml` 在输入 MD > 15000 字符时，截断到 15000 并追加截断提示，正常返回 `HtmlAnalysis`
- AC-8：所有公开函数 TypeScript 严格模式编译通过，无 `any` 泄漏
- AC-9：`package.json` 中 `turndown` 与 `@types/turndown` 出现在正确 dependencies / devDependencies

### 交互变化结论

无（本 Spec Pack 不涉及 UI/页面改动，仅新增纯函数模块）

### 影响面

- 涉及文件：`lib/html.ts`（新建）、`package.json`、`package-lock.json`
- 涉及依赖：`turndown`、`@types/turndown`
- 涉及环境变量：复用现有 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`（无新增）
- 涉及权限点：无
- 涉及 API Route：无
- 涉及数据库表：无
- 涉及外部服务：Anthropic Claude API（与 001 共用 Key）
- 调用方（未来）：001-competitor-tracking v2、其他 Spec Pack、可能的 admin 调试工具