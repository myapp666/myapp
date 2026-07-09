---
title: 002-html-md-analysis 测试计划（Test Plan）
status: ready
version: v1.1
date: 2026-07-09
reviewed_at: 2026-07-09  # v1.1 全面复核：实测重跑 17/17 PASS + tsc 0；发现并登记 AC-5/V-002 口径漂移（见 §8.1 / §9 R8 / 附录 B）
---

# 测试计划（Test Plan）— 002-html-md-analysis

> 范围/策略/环境/准入准出口径冻结；用例/套件/报告将基于本计划展开。
> 追溯入口：[requirements/solution.md §8 Mini-PRD](../requirements/solution.md)、[implementation/plan.md §验收口径](../implementation/plan.md)。

---

## 1. 基本信息

- **Spec / Feature**：`002-html-md-analysis`（FEATURE_DIR = `.aisdlc/specs/002-html-md-analysis`）
- **版本/构建**：`v1.1`（v1.0 首版冻结 → v1.1 全面复核）；实现 commit `676ddf7` + 测试 commit `1c86b42`（`git log --all` 可达，工作区 `lib/html.ts` / `scripts/test-html.mts` 已提交无改动）
- **环境**：Dev（仓库根，单机 Node v24.18.0）；生产部署环境 Vercel（仅作部署兼容回归）
- **测试负责人**：DEV（单测执行）+ Spec 作者（验收口径确认）
- **计划日期**：2026-07-09
- **代码仓**：根项目（无 `.gitmodules`，Next.js 15 单体）

---

## 2. 执行摘要

- **待测能力**：`lib/html.ts` 双函数模块 —— `cleanHtmlToMarkdown(html)` 把任意 HTML 字符串清洗为 GFM Markdown；`analyzeHtml(md, opts?)` 调用 Claude 输出 `HtmlAnalysis`（`content_type` / `summary` / `importance`）。
- **目标**：冻结 AC-1~AC-9 与 V-001~V-006 的口径；用最小脚本化验证使 9 条 AC 全部通过；让 v2 调用方（001 v2、其他 Spec Pack）可以无歧义地复用。
- **关键风险**：
  1. turndown 对异常输入（空串、纯文本、未闭合标签、内嵌 `<script>`、含 emoji/中文长串）抛错或输出乱码（V-001）
  2. Anthropic SDK 抛错 / 超时 / 模型不返回 JSON / JSON 缺字段 时 `analyzeHtml` 兜底行为不符预期（V-002）
  3. 超长 MD（>15000 字符）触发模型上下文超限，需截断生效且不破坏 JSON 输出（V-003）
  4. 新模块与 `lib/llm.ts` 的 prompt/extractJson/兜底风格分叉（V-006）
  5. 项目知识库 4 项文件缺失，影响后续 Discover/Impact Analysis 质量（V-005）
  6. **（v1.1 复核新增）需求口径缺陷**：solution.md §8 AC-5 与 §5 V-002 信号把兜底写成 `content_type=""` / `importance=""`，但 `HtmlAnalysis` 的类型联合不含 `""`（该值 tsc 非法）；as-built 实现用 `content_type="其他"` / `importance="低"` 才类型合法。实现正确，需求文本待订正（见 §8.1 / §9 R8）
- **结论门槛（预告）**：见 §8 准出标准 —— P0 用例 + smoke 全过、无 Critical/P0 阻断缺陷、9 条 AC + 6 项 V 验证全部覆盖。
- **v1.1 复核实测证据（2026-07-09 重跑）**：`node --experimental-strip-types scripts/test-html.mts` → `PASS: 17 / FAIL: 0`，退出码 0；`npx tsc --noEmit` 退出码 0。口径以 as-built 为准。

---

## 3. 测试范围

### 3.1 范围内（In Scope）

- `lib/html.ts` 新增模块的全部公开符号：
  - `cleanHtmlToMarkdown(html: string): string`
  - `analyzeHtml(markdown: string, opts?: { prompt?: string }): Promise<HtmlAnalysis>`
  - `interface HtmlAnalysis { content_type: "文章" | "产品页" | "文档" | "营销页" | "其他"; summary: string; importance: "低" | "中" | "高" }`
- 异常输入行为（V-001）：空串 / 纯文本 / 未闭合标签 / 含 `<script>` 内嵌 / 含 emoji + 中文长串
- AI 调用异常兜底（V-002）：SDK 抛错 / 超时 / 文本非 JSON / JSON 缺 `content_type` / JSON 缺 `summary`
- 超长输入截断（V-003）：>15000 字符截断到 15000，summary 反映"输入已截断"
- v2 增量签名保留（V-004）：`opts.readability?: boolean` 形参签名（仅类型，未实现）
- 与 `lib/llm.ts` 的风格一致性 review（V-006）：prompt 模板 / extractJson / 字段缺失兜底
- 仓库级 `npm run build` 通过（Next.js 15 单体编译消费 `lib/html.ts`）
- TypeScript 严格模式编译（`npx tsc --noEmit` 退出码 0）

### 3.2 范围外（Out of Scope）

- 不抓 URL、不读文件、不持有 IO/异步副作用（IO 由调用方处理）
- 不分块、不流式、不并发限流（留待 v2）
- 不引入 `@mozilla/readability` / `jsdom` / 正则剥离
- 不新增 Next.js API Route、不动 `prisma/schema.prisma`、不动 001-competitor-tracking
- 不新增 Vercel 部署 env、不动 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`
- 不实施 v2 readability 双路径（仅类型签名预留，参见 V-004）
- UI/页面交互：无（本 Spec Pack 不涉及任何 UI 改动）

---

## 4. 测试策略

### 4.1 测试类型

- [x] 功能（Functional）：核心 —— 9 条 AC 全部为功能验收
- [ ] UI/交互（UI）：不适用（纯函数模块，无 UI）
- [x] 集成（Integration）：与 Anthropic SDK、`lib/llm.ts` 风格对齐
- [x] 回归（Regression）：`npm run build` 通过 + `lib/*.ts` 既有模块不被影响
- [ ] 安全（Security）：MVP 不涉及（无新 env、无新接口、无新权限面）
- [x] 性能/稳定性（Performance/Stability）：超长输入截断（V-003）保证上下文不超限

### 4.2 方法与设计原则

- **正向**：标准 HTML（h1/p/table/code/link/img）→ GFM Markdown；mock SDK 返回合法 JSON → 字段完全匹配
- **反向**：SDK 抛错 / 超时 / 非 JSON / 缺字段 → 兜底结构体；非法 HTML 输入 → 空字符串或合法 MD
- **边界值**：空字符串、纯文本、>15000 字符、含 emoji/中文/未闭合标签/`<script>` 内嵌
- **等价类**：5 类异常输入（V-001）+ 5 类 AI 异常（V-002）—— 覆盖 P0 阻断点
- **覆盖关键路径优先**：先阻断点（V-002 兜底、V-001 不抛错），后长尾（V-003 截断）
- **每一步必须有可观测预期**：所有断言都打 PASS/FAIL，退出码 0/1 明确
- **mock 优先**：不依赖真实 API Key（mock Anthropic 客户端通过 `process.env.MOCK_AI_MODE` 切换行为）

---

## 5. 回归策略（必须填写）

> 本 Spec Pack 为纯前端 lib 增量变更，无页面/接口层改动；回归分层以单测脚本为主，build 为辅。

### 5.1 Smoke（≤5 分钟）

- **目的**：快速确认 `lib/html.ts` + `scripts/test-html.mts` 在本地可执行
- **阻断规则**：任一 smoke 断言失败即阻断后续回归并判定"不具备交付条件"
- **覆盖**：
  - `node --experimental-strip-types scripts/test-html.mts` 退出码 0
  - `npx tsc --noEmit` 退出码 0（TypeScript 严格模式编译）
  - AC-1（标准 HTML → GFM）/ AC-2（空串）/ AC-3（纯文本）3 条基础断言

### 5.2 Targeted（≤15 分钟）

- **触发条件**：smoke 全过后；或 `lib/html.ts` / `scripts/test-html.mts` 任何变更
- **覆盖**：
  - V-001 全 5 类异常输入（空串 / 纯文本 / 未闭合标签 / `<script>` 内嵌 / emoji+中文长串）
  - V-002 全 5 类 AI 异常（throw / 超时 / 非 JSON / 缺 `content_type` / 缺 `summary`）
  - V-003 超长输入截断（输入 20000 字符 → summary 含"截断"字样）
  - V-006 CR 风格对照（与 `lib/llm.ts` 的 prompt/extractJson/兜底逐项比对）
  - `npm run build` 退出码 0（Next.js 15 单体编译消费新模块）

### 5.3 Full（≤60 分钟）

- **目的**：发布前/版本合并前全面验证（本 MVP 阶段与 Targeted 重合，v2 出现调用方时升级为 Full）
- **覆盖**：
  - Targeted 全部用例
  - V-004 类型签名校验（`opts.readability?: boolean` 不破坏现有行为）
  - 真实 API Key 可选跑通（仅当 `.env.local` 含 `AI_API_KEY` 时；非阻断）

---

## 6. 环境与数据

### 6.1 环境矩阵

| 维度 | 值 |
|---|---|
| OS | Windows 11（开发机） / Vercel Node 运行时（生产） |
| 运行时 | Node v24.18.0（支持 `--experimental-strip-types`） |
| 浏览器 | N/A（纯函数 lib，无浏览器侧改动） |
| 设备 | Desktop only（开发机执行） |
| 后端环境 | Dev（本地） / Prod（Vercel，仅部署兼容回归） |

### 6.2 账号与权限

- **测试账号**：N/A（纯函数 lib，无账号/权限维度）
- **角色/权限**：N/A
- **开关/配置**：
  - `process.env.MOCK_AI_MODE`：控制 mock SDK 行为（`ok` / `throw` / `bad_json` / `missing_summary` / `truncation`）
  - `.env.local` 中 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`：可选，用于真实调用验证（非阻断）

### 6.3 测试数据准备

- **数据集来源**：内联在 `scripts/test-html.mts`（h1/p/table/code/link/img 各一例 + 5 类异常输入 + 1 个 20000 字符长串）
- **重置方式**：测试脚本无副作用（仅读取函数输出，无 IO 写入）
- **清理要求**：无需清理（无临时文件、无 DB 写入、无网络副作用）

---

## 7. 准入标准（Entry Criteria）

- [x] 需求口径已冻结：`requirements/solution.md`（澄清记录 5 轮已收敛）+ `requirements/raw.md` 可追溯；Mini-PRD §8 固化了 AC-1~AC-9
- [x] 测试环境可用：Node v24.18.0、`turndown` / `@types/turndown` 已在 `package.json`、`scripts/test-html.mts` 可执行
- [x] 测试账号/权限/数据准备完成：N/A（无账号维度）；mock SDK 内联在测试脚本；测试数据内联
- [x] 构建已部署且版本可追溯：`npm run build` 退出码 0；commit `676ddf7`（lib/html.ts）+ `1c86b42`（scripts/test-html.mts + headingStyle=atx）
- [x] `lib/html.ts` 已实现并 TypeScript 严格模式编译通过（`npx tsc --noEmit` 退出码 0，T1 验证记录 2026-07-09）
- [x] `scripts/test-html.mts` 已实现并跑通 17/17 断言（T2 验证记录 2026-07-09）

---

## 8. 准出标准（Exit Criteria，必须含阻断口径）

### 8.1 通过（Pass / Go）

- [x] 所有 P0 用例通过：9 条 AC 全部满足（T2 验证 17/17 PASS 覆盖 AC-1~AC-7；AC-8/AC-9 由 `npx tsc --noEmit` + `package.json` 检查覆盖）
  - **（v1.1 复核）AC-5/AC-6 以 as-built 口径为准**：`analyzeHtml` 兜底为 `content_type="其他"` / `importance="低"`，`summary=""`（缺字段）或 `"[AI 解读失败, 原因: ...]"`（异常）。solution.md §8 AC-5 / §5 V-002 里写的 `content_type=""` / `importance=""` 与 `HtmlAnalysis` 类型联合冲突（`""` 非法），已登记为 R8 待订正需求文本；测试脚本断言的 `其他`/`低` 为正确期望值，17/17 PASS 有效。
- [x] smoke 套件通过：`scripts/test-html.mts` 退出码 0（AC-1/2/3 + 编译检查）
- [x] 无阻断缺陷（Critical/P0）：T2 期间发现 2 个 bug 已当场修复并回归通过（turndown setext→atx；mock server body 捕获）
- [x] 关键风险验证动作完成且无未闭环阻断项：V-001~V-006 全部有覆盖（V-001~V-003 由 17 条断言覆盖；V-004 由类型签名覆盖；V-006 由 T4 CR 通过；V-005 在 merge-back 阶段处理，登记为 MB-001）

### 8.2 不通过（Fail / No-Go）

- [ ] 任一 P0 用例失败（即 AC-1~AC-9 任意一条失败）
- [ ] `scripts/test-html.mts` smoke 套件失败（退出码非 0）
- [ ] `npx tsc --noEmit` 失败（TypeScript 严格模式编译报错）
- [ ] `npm run build` 失败（Next.js 单体无法消费新模块）
- [ ] `lib/html.ts` 与 `lib/llm.ts` 风格分叉且 CR 不通过（V-006 不通过）
- [ ] 发现数据丢失/安全事故/不可逆风险（本 MVP 无数据/安全维度，主要指 AC-5 兜底被绕过导致调用方收到未定义对象）

### 8.3 有条件通过（Conditional Pass）

- [ ] V-005（项目知识库补齐）未在本次 Spec Pack 内闭环 —— 已在 `implementation/plan.md §Merge-back` 登记 MB-001，触发条件为后续 Spec Pack 通过 `project-discover-modules-contracts` 补齐 `components/lib.md`
- [ ] `npm run lint` 因项目预存状态跳过（Next.js 16 `next lint` deprecated + 仓库无 ESLint 配置；不阻断本次交付，记录为后续 Spec Pack 待办）
- [ ] 遗留风险已记录且已获干系人接受：以上 2 项均在 T3/T4 验证记录中显式登记

---

## 9. 风险与验证清单（必须可执行）

| 风险 | 概率 | 影响 | 验证动作（最小） | Owner | 截止 | 信号/证据 |
|---|---|---|---|---|---|---|
| R1（V-001）turndown 对异常输入抛错或输出乱码 | 中 | 高（阻塞 AC-1/2/3） | `scripts/test-html.mts` 跑 5 类异常输入断言 | DEV | 2026-07-09（T2 完成） | 5/5 断言 PASS（已通过，commit `1c86b42`） |
| R2（V-002）Anthropic SDK 异常/字段缺失兜底不符预期 | 中 | 高（阻塞 AC-5/6，破坏调用方契约） | mock SDK 跑 5 类异常断言 | DEV | 2026-07-09（T2 完成） | 5/5 断言 PASS（已通过，含 `[AI 解读失败` 字样兜底） |
| R3（V-003）超长输入触发模型上下文超限 | 低 | 中（影响 AC-7，长 HTML 用户受影响） | 输入 20000 字符断言截断生效 + summary 含"截断"字样 | DEV | 2026-07-09（T2 完成） | 1/1 断言 PASS（已通过，截断到 15000） |
| R4（V-006）`lib/html.ts` 与 `lib/llm.ts` 风格分叉 | 低 | 中（维护成本 + 后续复用困惑） | T4 CR 逐项对照 prompt/extractJson/兜底 | CR reviewer | 2026-07-09（T4 完成） | CR 通过，3 处差异均为业务差异（已记录） |
| R5（V-005）项目知识库 4 项文件缺失，影响 Discover/Impact Analysis | 高 | 中（不阻断本次交付，但影响后续 Spec Pack） | 在 `implementation/plan.md §Merge-back` 登记 MB-001 | Spec 作者 / Maintainer | Merge-back 阶段 | MB-001 已登记；触发 `project-discover-modules-contracts` 补齐 `components/lib.md` |
| R6 `npm run lint` 因项目预存状态跳过 | 中 | 低（不阻断构建，但缺少静态检查） | T3 跳过理由显式登记；后续 Spec Pack 独立处理 | DEV | 后续 Spec Pack | T3 验证记录已说明：Next.js 16 `next lint` deprecated + 无 ESLint 配置 |
| R7 `package.json` 因 `npm install` hash 变化产生非预期 diff | 低 | 低（lock 漂移，code review 可见） | 对比 `git diff package-lock.json` 与预期 turndown hash | DEV | T1 commit 阶段 | 已确认 turndown 已声明，本次未触发 lock 变更（T1 commit `676ddf7` 仅含 `lib/html.ts`） |
| R8（v1.1 复核新增）需求文本 AC-5/V-002 信号写 `content_type=""`/`importance=""`，与 `HtmlAnalysis` 类型联合冲突（`""` 非法） | 中 | 中（口径错误会误导 usecase/suites 断言，且真按 `""` 断言会 tsc 失败） | 复核 `lib/html.ts:135-146` 兜底 = `其他`/`低`；对照测试脚本断言 | Spec 作者 / DEV | 下个回写窗口 | as-built 口径正确（`其他`/`低`）；**动作**：订正 solution.md §8 AC-5 与 §5 V-002 信号为 `其他`/`低`，或标注被本 test-plan §8.1 as-built 口径取代（不阻断本次交付，实现无需改） |
| R9（v1.1 复核）实测口径是否仍为真（防文档漂移） | 低 | 中 | 重跑 `scripts/test-html.mts` + `tsc --noEmit` | DEV | 2026-07-09（v1.1 复核） | ✅ 已重跑：`PASS: 17 / FAIL: 0` 退出码 0；`tsc --noEmit` 退出码 0；commit `676ddf7`/`1c86b42` 可达 |

---

## 10. 追溯链接（必须）

- `requirements/solution.md`：[.aisdlc/specs/002-html-md-analysis/requirements/solution.md](../requirements/solution.md)
  - §8 Mini-PRD（AC-1~AC-9）
  - §5 验证清单（V-001~V-006）
  - §7 Impact Analysis（受影响模块 + 不变量 + Context Gaps）
- `requirements/raw.md`：[.aisdlc/specs/002-html-md-analysis/requirements/raw.md](../requirements/raw.md)
  - 澄清记录第 1~5 轮（定位、输入契约、清洗引擎、AI 契约、JSON schema）
- `requirements/prd.md`：**不存在**（澄清记录第 3~5 轮明确跳过，由 `solution.md §8 Mini-PRD` 替代 —— 已在 solution.md §0 显式登记）
- `requirements/solution.md#impact-analysis`：[.aisdlc/specs/002-html-md-analysis/requirements/solution.md#7-impact-analysis](../requirements/solution.md#7-impact-analysis需求影响分析)
- `implementation/plan.md`：[.aisdlc/specs/002-html-md-analysis/implementation/plan.md](../implementation/plan.md)
  - §验收口径（AC-1~AC-9）
  - §任务清单（T0~T4，含 commit/验证结果）
  - §Merge-back 待办（MB-001）
- `verification/usecase.md`：待生成（`spec-test-usecase` 阶段产出）
- `verification/suites.md`：待生成（`spec-test-suites` 阶段产出）
- `verification/report-*.md`：待生成（`spec-test-execute` 阶段产出）
- 项目知识库追溯：
  - `.aisdlc/project/adr/001-nextjs-monolith.md`（Next.js 15 单体架构，Vercel 部署）
  - `lib/llm.ts`（Anthropic SDK + env 约定 + extractJson 防御性解析 + ChangeAnalysis 兜底风格参照）

---

## 11. CONTEXT GAP（如有）

- `CONTEXT GAP`：`.aisdlc/project/memory/product.md` 不存在 → 无法消费"产品定位/北极星指标"约束 → 已在 `solution.md §7.4` 登记；建议通过 `project-discover-preflight-scope` 在后续 Spec Pack 补齐
- `CONTEXT GAP`：`.aisdlc/project/memory/glossary.md` 不存在 → 无法消费"业务术语表"约束 → 同上
- `CONTEXT GAP`：`.aisdlc/project/memory/tech.md` 不存在 → 无法消费"技术栈约束"约束 → 同上（V-005 + MB-001 已显式登记）
- `CONTEXT GAP`：`.aisdlc/project/products/index.md` 不存在 → 无法定位本 Spec Pack 在产品矩阵中的归属 → MVP 阶段接受此缺口（澄清记录已说明本 lib 跨多个未来产品复用）
- `CONTEXT GAP`：`.aisdlc/project/components/index.md` 不存在 → 无法消费模块地图 → 通过 `project-discover-modules-contracts` 在后续 Spec Pack 补齐 `components/lib.md`（V-005 验证动作，MB-001 已登记）
- `CONTEXT GAP`：`requirements/prd.md` 不存在 → 由 `requirements/solution.md §8 Mini-PRD` 替代（澄清记录第 3~5 轮明确跳过独立 prd.md/prototype.md，详见 solution.md §0 注释）—— **不构成阻塞**，Mini-PRD 已固化 9 条 AC
- **CONTEXT GAP 对测试计划的影响**：上述 4 项项目知识库缺口均不影响本次 MVP 验证（模块定位、术语、技术栈、产品矩阵对纯函数 lib 的可测性无直接影响）；它们影响的是后续 Spec Pack 的 Discover/Impact Analysis 质量，已在 V-005 + MB-001 显式登记

---

## 附录 A：当前实现状态速查（来自 implementation/plan.md）

| Task | 状态 | Commit | 验证 |
|---|---|---|---|
| T0 环境验证 | ✅ | N/A | Node v24.18.0 + turndown 已声明 + lib/html.ts 不存在 |
| T1 实现 lib/html.ts | ✅ | `676ddf7` | `npx tsc --noEmit` 退出码 0 |
| T2 写测试脚本 | ✅ | `1c86b42` | 17/17 PASS（含 headingStyle=atx 修复 + mock body 捕获修复） |
| T3 lint + build | ✅（lint 跳过） | N/A | `npm run build` 退出码 0；lint 因项目预存状态跳过 |
| T4 CR + 最终评审 | ✅ | N/A | V-006 通过；3 处业务差异（max_tokens/接口字段/函数参数），无实现风格分叉 |

**结论**：本测试计划准入条件已全部满足，可进入 `spec-test-usecase` / `spec-test-suites` / `spec-test-execute` 阶段；用例与套件生成可基于本计划的范围/策略/AC-1~AC-9/V-001~V-006 直接展开。

**v1.1 复核补充（2026-07-09）**：重跑实测证据仍为真（`scripts/test-html.mts` 17/17 PASS、`tsc --noEmit` 退出码 0、commit `676ddf7`/`1c86b42` 可达、工作区无改动）。复核发现 1 项需求口径缺陷（R8：solution.md AC-5/V-002 的 `""` 兜底类型非法），as-built 口径 `其他`/`低` 为准；下游 `spec-test-usecase` 生成 AC-5/AC-6 用例时**必须**用 `content_type="其他"` / `importance="低"` 作为期望值，不得照抄 solution.md 的 `""`。

---

## 附录 B：迭代记录

- 2026-07-09 v1.0（首版）：基于已完成的 I2（T0~T4 全部 ✅）产出测试计划；冻结 9 条 AC + 6 项 V-xxx + 7 条风险（R1~R7）的口径；显式登记 4 项项目知识库 Context Gap 与 1 项 Mini-PRD 替代 prd.md 的合理 Context Gap。
- 2026-07-09 v1.1（全面复核）：重跑实测（`scripts/test-html.mts` 17/17 PASS、`tsc --noEmit` 退出码 0、commit `676ddf7`/`1c86b42` 可达、工作区无改动）；新增 R8（solution.md AC-5/§5 V-002 兜底写成 `content_type=""`/`importance=""`，与 `HtmlAnalysis` 类型联合冲突，as-built 应为 `其他`/`低`）与 R9（防文档漂移的复核动作）；在 §2 / §8.1 / 附录 A 显式登记 as-built 口径优先，并要求下游 usecase 用 `其他`/`低` 作为 AC-5/AC-6 期望值。**结论：DoD 全部满足，无阻断项；R8 为需求文本订正待办，不阻断本次交付，实现无需改。**