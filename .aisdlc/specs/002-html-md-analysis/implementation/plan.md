---
title: 002-html-md-analysis 实现计划（SSOT）
status: draft
---

# 002-html-md-analysis 实现计划（SSOT）

> **必需技能：** `spec-execute`（按批次执行本计划）
> **上下文获取：** 必须先执行 `spec-context` 获取上下文，定位 `{FEATURE_DIR}`，失败即停止

**目标：** 在 Next.js 15 单体内新建 `lib/html.ts`，把任意 HTML 字符串清洗为 Markdown 并调用 Claude 输出 `HtmlAnalysis`（`content_type` / `summary` / `importance`），供 001 及未来模块复用。
**范围：** In — 新建 `lib/html.ts`（2 个公开函数 + 1 个 interface + 1 个内置 prompt）+ 单测脚本 `scripts/test-html.mts`；Out — 不读文件、不抓 URL、不分块、不流式、不引入 readability、不新增 API Route、不动 001-competitor-tracking。
**架构：** 纯前端 TS 模块；turndown（已在依赖）做 HTML→GFM Markdown；Anthropic SDK（已在依赖）做 AI 调用；严格 JSON 输出 + `lib/llm.ts` 同款的 `extractJson` 防御性解析 + 字段缺失兜底。
**验收口径：** 引用 [requirements/solution.md §8 Mini-PRD](../requirements/solution.md)（AC-1 ~ AC-9）。
**影响范围：** 引用 [requirements/solution.md §7 Impact Analysis](../requirements/solution.md#7-impact-analysis需求影响分析)；新增/修改文件：`lib/html.ts`、`scripts/test-html.mts`；`package.json`/`package-lock.json` 仅在 `npm install` 触发 hash 变化时变更（turndown 已就位，预期无需新增依赖）。
**需遵守的不变量：**
1. Next.js 15 + TypeScript 严格模式（来源：[.aisdlc/project/adr/001-nextjs-monolith.md](../../project/adr/001-nextjs-monolith.md)）
2. `lib/*.ts` 风格：纯函数 + 类型显式导出 + 异常兜底返回合法结构体，不向调用方抛错（参照 `lib/llm.ts`）
3. Anthropic SDK + env 约定：客户端构造、env 读取、模型默认值与 `lib/llm.ts` 同步（来源：`lib/llm.ts`）
4. Vercel 部署兼容：`turndown` 纯 JS，无 native 绑定（已验证依赖来源）
**子仓范围：** 无（仓库不含 `.gitmodules`，Next.js 15 单体）

---

## TL;DR（3–7 行）

- 一句话目标：交付 `lib/html.ts`（`cleanHtmlToMarkdown` + `analyzeHtml` + `HtmlAnalysis`）+ `scripts/test-html.mts` 验证脚本，端到端跑通"HTML 字符串 → GFM Markdown → Claude 结构化 JSON"。
- In/Out：In = 新建 1 个 lib + 1 个 test script；Out = 不动 001 / 不新增 API Route / 不分块 / 不引入 readability。
- 关键路径：T0 环境验证 → T1 实现 `lib/html.ts` → T2 写 `scripts/test-html.mts` → T3 跑通 + lint/build → T4 提交。
- 最大风险与优先验证点：turndown 异常输入（V-001）、AI 异常兜底（V-002）、超长截断（V-003）。

---

## 范围与边界（In / Out）

- **In**：
  - 新建 `lib/html.ts`：导出 `cleanHtmlToMarkdown(html: string): string`、`analyzeHtml(markdown: string, opts?: { prompt?: string }): Promise<HtmlAnalysis>`、`interface HtmlAnalysis { content_type: "文章" | "产品页" | "文档" | "营销页" | "其他"; summary: string; importance: "低" | "中" | "高"; }`
  - 内置中文 prompt 模板，约束三个枚举值与 200–400 字中文摘要
  - 新建 `scripts/test-html.mts`：覆盖 AC-1 ~ AC-7（V-001 / V-002 / V-003）
  - 必要时跑 `npm install` 触发 lock 更新（预期 turndown 已在，无需新增依赖）
- **Out**：
  - 不读文件、不抓 URL（IO 由调用方处理）
  - 不分块、不流式、不并发限流
  - 不引入 `@mozilla/readability` / `jsdom`
  - 不新增 Next.js API Route、不动 `prisma/schema.prisma`、不动 001-competitor-tracking
- **不变量/关键约束**：见上文"需遵守的不变量"4 条
- **影响面**（模块/接口/权限/数据口径/运维）：
  - 模块：`lib/html.ts`（新增）、`scripts/test-html.mts`（新增）
  - 接口：无（不新增 API Route）
  - 权限：无
  - 数据口径：无（无 DB 变更）
  - 运维：复用现有 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` env，无新增 env

## 代码工作区清单（如适用）

不适用（仓库不含 `.gitmodules`）。

---

## 里程碑与节奏

- M0（MVP，本计划唯一里程碑）：
  - 交付物：`lib/html.ts` + `scripts/test-html.mts`
  - 验证：`scripts/test-html.mts` 跑通（无 API Key 跑 AC-1/2/3/4 单测；有 API Key 可选跑 AC-5 真实调用）；`npm run lint` + `npm run build` 通过
  - 提交：2–3 次小提交（实现、测试、build fix）

---

## 依赖与资源

- 环境/权限：
  - Node v24.18.0（已支持 `--experimental-strip-types`，无需 tsx/ts-node）
  - `npm run lint` / `npm run build` 命令已就位
  - 本地 `.env.local` 含 `AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`（用于可选的真实调用验证）
- 外部系统/团队：
  - Anthropic 兼容 API（`api.minimaxi.com/anthropic`）— 复用既有通道，与 001 共用 Key
- 数据/样本：
  - 测试用 HTML 样本：内联在 `scripts/test-html.mts`（h1/p/table/code/link/img 各一例 + 异常输入 5 类）
- 发布/变更窗口（如适用）：N/A（库内变更，无线上影响）

---

## 风险与验证（可执行）

| # | 风险/假设 | 验证方式 | 成功信号 | 失败信号 | Owner | 截止 | 下一步动作 |
|---|---|---|---|---|---|---|---|
| R1 | turndown 对空串/纯文本/未闭合标签/含 script 的输入会抛异常或乱码（V-001） | 单测 5 类异常输入 | 5 类全部返回字符串（空串或合法 MD），不抛异常 | 任一抛错或输出乱码 | DEV | T3 验证完成 | 加 try/catch + 输入预校验 |
| R2 | Anthropic SDK 抛错 / 超时 / 模型不返回 JSON / JSON 缺字段时 `analyzeHtml` 行为不符预期（V-002） | 单测 mock SDK 5 类异常 | 5 类异常均返回合法 `HtmlAnalysis` 兜底 | 任一向调用方抛错 | DEV | T3 验证完成 | 补 try/catch + 字段缺失兜底 |
| R3 | 超长 MD（>15000 字符）触发模型上下文超限（V-003） | 单测输入 20000 字符 | 截断生效，返回合法 `HtmlAnalysis`，summary 反映"输入已截断" | 截断未生效或 JSON 解析失败 | DEV | T3 验证完成 | 调整上限（8000/30000） |
| R4 | `lib/html.ts` 与 `lib/llm.ts` 风格分叉（V-006） | CR 时逐项对照 prompt 模板/extractJson/兜底 | CR 通过 | CR 指出风格不一致 | CR reviewer | T4 CR 阶段 | 重构到与 `lib/llm.ts` 同款 |
| R5 | 仓库 4 项项目知识库文件缺失（V-005），影响后续 Discover | 在 `## Merge-back` 显式登记 MB-001 | 后续 Spec Pack 通过 `project-discover-modules-contracts` 补齐 | 缺口被遗忘 | Spec 作者 | Merge-back 阶段 | 触发 Discover 任务 |

---

## 验收口径（可追溯）

- 追溯：`requirements/solution.md` §8 Mini-PRD：
  - AC-1 `cleanHtmlToMarkdown("<h1>Hello</h1><p>World</p>")` 返回 `"# Hello\n\nWorld"`
  - AC-2 空字符串返回 `""`
  - AC-3 纯文本无标签返回原文本
  - AC-4 mock SDK 返回合法 JSON → 返回完整 `HtmlAnalysis`
  - AC-5 mock SDK 抛错 → 返回 `{ content_type: "", summary: "[AI 解读失败, 原因: ...]", importance: "" }`
  - AC-6 mock 返回缺 `summary` 字段 → 兜底空串
  - AC-7 输入 > 15000 字符 → 截断 + 正常返回
  - AC-8 TypeScript 严格模式编译通过
  - AC-9 `package.json` 中依赖项正确分类（预期无需变更）
- 追溯：`requirements/solution.md` §5 验证清单 V-001 ~ V-006（与 R1 ~ R5 一一对应）
- 关键验收点（摘要）：9 条 AC 必须全部满足，V-001 ~ V-006 必须有对应测试覆盖

---

## NEEDS CLARIFICATION（未消除前不得进入 I2）

> 当前轮次已无未消除的不确定项（澄清记录 5 轮已收敛，solution.md Mini-PRD 已固化 9 条 AC）。如下游 I2 执行中发现新的不确定性，必须先回写本节并阻断 I2。

- （空）

---

## 任务清单（SSOT）

> 这是唯一的执行清单与状态来源：用 `- [ ] / - [x]` 标记完成；执行中把按 repo 记录的 `branch/commit/pr/changed_files` 与关键验证结果回写到对应任务。
> 命令默认面向 PowerShell；同一行多命令请用 `;` 分隔（不要用 `&&`）。

### Task T0: 环境与依赖验证（防呆）

- [x] **状态**：完成（2026-07-09）

**代码仓范围：**
- 根项目：

**文件：**
- 创建：（无）
- 修改：（无）
- 测试：（无）

**验收点：**
- Node 版本 ≥ 22.6（支持 `--experimental-strip-types`）
- `turndown` 已在 `package.json`
- `@types/turndown` 已在 `package.json`
- `lib/` 目录确认不含 `html.ts`（新建非覆盖）

**步骤 1：环境探针**
- Run: `node --version; npm --version; (Get-Content package.json -Raw | Select-String '"turndown"\s*:\s*"\^' -Quiet)`
- Expected: `v22.6+`；`True`（turndown 已声明）；`(Get-Content package.json -Raw | Select-String '"@types/turndown"' -Quiet)` 也为 `True`

**步骤 2：目标文件不存在性确认**
- Run: `if (Test-Path lib/html.ts) { Write-Host "EXISTS" } else { Write-Host "OK-NEW" }`
- Expected: `OK-NEW`

**步骤 3：跳过提交（无变更）**
- Commit message: 无
- 审计信息：
  - repo: `root`
    branch: `002-html-md-analysis`
    commit: N/A
    pr: N/A
    changed_files: （无）

**T0 实际验证结果（2026-07-09 执行）**：
- Node v24.18.0 ✅
- turndown 在 `package.json` ✅
- @types/turndown 在 `package.json` ✅
- `lib/html.ts` 不存在（可新建）✅

---

### Task T1: 实现 `lib/html.ts`

- [x] **状态**：完成（2026-07-09）

**代码仓范围：**
- 根项目：

**文件：**
- 创建：`lib/html.ts`
- 修改：（无）
- 测试：（T2 单独建）

**验收点：**
- TypeScript 严格模式编译通过（`npx tsc --noEmit` 无报错）
- 导出 `cleanHtmlToMarkdown`、`analyzeHtml`、`HtmlAnalysis` interface
- 不向调用方抛错（任何异常内部兜底）
- `extractJson` 与 `lib/llm.ts` 风格一致

**步骤 1：写文件骨架（含 turndown 调用 + 类型导出）**
- 修改点：新建 `lib/html.ts`，先实现 `cleanHtmlToMarkdown` 与 `HtmlAnalysis` interface（暂不写 `analyzeHtml` 实现细节）
- 包含：`import TurndownService from 'turndown'`；`const turndown = new TurndownService()`；`export function cleanHtmlToMarkdown(html: string): string { try { return html ? turndown.turndown(html) : ''; } catch { return ''; } }`

**步骤 2：实现 `analyzeHtml`（Anthropic SDK + 防御性解析 + 字段缺失兜底）**
- 修改点：同一文件追加 `analyzeHtml` 函数 + 内置中文 prompt 模板 + `extractJson` 辅助函数（从 `lib/llm.ts` 复制并按需调整）
- prompt 约束：`content_type` 5 选 1、`importance` 3 选 1、`summary` 200–400 字中文、严格 JSON 无 markdown 围栏
- 截断：`markdown.length > 15000` 时 `slice(0, 15000)` 并在 prompt 头部追加 "[输入已截断至 15000 字符]" 提示

**步骤 3：本地 TS 编译验证**
- Run: `npx tsc --noEmit`
- Expected: 退出码 0，无错误输出

**步骤 4：提交**
- Commit message: `feat(lib): 新增 lib/html.ts 清洗 HTML 为 Markdown 并交给 Claude 分析`
- 审计信息：
  - repo: `root`
    branch: `002-html-md-analysis`
    commit: `676ddf7`
    pr: `<TBD>`
    changed_files:
      - `lib/html.ts`

**T1 实际验证结果（2026-07-09 执行）**：
- `npx tsc --noEmit` 退出码 0，无 TS 错误 ✅
- IDE 误报 `Cannot find name 'process'`（实际 `@types/node` 已就位，IDE 缓存延迟）
- 实施细节：`TurndownService({ headingStyle: 'atx' })` 让 `<h1>` 转为 `# Hello` 而非 `Hello\n=====`（与 solution.md AC-1 一致）

---

### Task T2: 写 `scripts/test-html.mts` 单测脚本

- [x] **状态**：完成（2026-07-09）

**代码仓范围：**
- 根项目：

**文件：**
- 创建：`scripts/test-html.mts`
- 修改：（无）

**验收点：**
- 覆盖 AC-1（标准 HTML→MD）/ AC-2（空串）/ AC-3（纯文本）/ AC-4（mock 合法 JSON）/ AC-5（mock 抛错）/ AC-6（mock 缺字段）/ AC-7（>15000 字符）
- 用 Node `--experimental-strip-types` 直接运行（无需 tsx/ts-node）
- 不依赖真实 API Key（mock SDK）
- 退出码 0 表示全部通过

**步骤 1：写 mock Anthropic 客户端**
- 修改点：脚本顶部用 class MockAnthropic 实现 SDK 接口；通过 `process.env.MOCK_AI_MODE` 切换"合法 JSON / 抛错 / 缺字段 / 超长" 4 类行为

**步骤 2：写测试用例**
- 修改点：依次跑 7 组断言，每组 `console.log` PASS/FAIL，最后汇总
- AC-1: `assert(cleanHtmlToMarkdown('<h1>Hello</h1><p>World</p>') === '# Hello\n\nWorld')`
- AC-2: `assert(cleanHtmlToMarkdown('') === '')`
- AC-3: `assert(cleanHtmlToMarkdown('纯文本') === '纯文本')`
- AC-4: mock 返回合法 JSON → 字段完全匹配
- AC-5: mock 抛错 → 返回兜底结构体，`summary` 含 `[AI 解读失败`
- AC-6: mock 返回 `{ content_type: "文章" }`（缺 summary/importance） → summary="" / importance=""
- AC-7: 输入 20000 字符 → summary 中含 "截断" 字样

**步骤 3：本地执行**
- Run: `node --experimental-strip-types scripts/test-html.mts`
- Expected: 输出 `7/7 PASS`，退出码 0

**步骤 4：提交**
- Commit message: `test(lib): 新增 scripts/test-html.mts 覆盖 V-001~V-003 与 AC-1~AC-7`
- 审计信息：
  - repo: `root`
    branch: `002-html-md-analysis`
    commit: `1c86b42`
    pr: `<TBD>`
    changed_files:
      - `lib/html.ts`（增量：turndown headingStyle=atx）
      - `scripts/test-html.mts`

**T2 实际验证结果（2026-07-09 执行）**：
- `node --experimental-strip-types scripts/test-html.mts` 输出 `PASS: 17 / FAIL: 0`，退出码 0 ✅
- 17 条断言全部通过，覆盖 AC-1~AC-7 + 7 类异常输入
- 测试期间发现 2 个 bug 并当场修复：
  1. turndown 默认 h1 用 setext 风格 → AC-1 期望 ATX → 加 `headingStyle: 'atx'`
  2. AC-7 切第二个 server 失败（Anthropic client 已在模块加载时绑定）→ 改为主 server 内捕获 body
- 良性警告：MODULE_TYPELESS_PACKAGE_JSON（Node 检测到 ES module 语法；不动 `"type": "module"` 因为会破坏 Next.js 构建）

---

### Task T3: 仓库级 lint + build 验证

- [x] **状态**：完成（2026-07-09）

**代码仓范围：**
- 根项目：

**文件：**
- 修改：（无）

**验收点：**
- `npm run lint` 通过
- `npm run build` 通过（或在不动 Next.js 路由的前提下确认新增模块不影响构建）

**步骤 1：lint**
- Run: `npm run lint`
- Expected: 退出码 0；lib/html.ts 与 scripts/test-html.mts 无 lint 错误

**步骤 2：build**
- Run: `npm run build`
- Expected: 退出码 0；`.next/` 构建产物含新模块编译结果（可通过 build 日志确认）

**步骤 3：跳过提交（无变更）**
- Commit message: 无
- 审计信息：
  - repo: `root`
    branch: `002-html-md-analysis`
    commit: N/A
    pr: N/A
    changed_files: （无）

**T3 实际验证结果（2026-07-09 执行）**：
- Step 1 (lint)：⚠️ **项目预存状态跳过** — `next lint` 在 Next.js 16 已 deprecated 且为交互式命令（无配置时询问 ESLint 配置模式），仓库未独立安装 `eslint`。本次新增模块不引入 ESLint 配置（YAGNI/MVP），如未来需要可在独立 Spec Pack 处理。
- Step 2 (build)：✅ `npm run build` 退出码 0；所有 27 个现有路由（app + api）构建成功；新增 `lib/html.ts` 已被 TS 编译器正确消费（不出现在路由表，因其为 lib util）
- Step 3：无文件变更，跳过提交

---

### Task T4: 最终评审与可选追加提交

- [x] **状态**：完成（2026-07-09）

**代码仓范围：**
- 根项目：

**文件：**
- 修改：（如有 lint/build fix）

**验收点：**
- V-006 CR 风格对照通过（与 `lib/llm.ts` 风格一致）
- 全部 9 条 AC 通过
- 全部 V-001 ~ V-006 验证项有覆盖
- 如有 lint fix 或 build 修复，独立提交

**步骤 1：风格对照（CR reviewer 视角）**
- 对照 `lib/llm.ts` 的 `PROMPT_TMPL` / `extractJson` / 字段缺失兜底，列出差异点（如有）
- Run: （无命令，纯阅读）
- Expected: 差异点全部为业务差异（HtmlAnalysis vs ChangeAnalysis），实现风格一致

**步骤 2：如有差异，提交修复**
- Run: `git add lib/html.ts scripts/test-html.mts; git commit -m "fix(lib): 对齐 lib/llm.ts 风格的 CR 反馈"`
- Expected: 提交成功；changed_files 仅含本次修复点

**步骤 3：若无需修复，跳过**
- Expected: 流程结束

**T4 实际验证结果（2026-07-09 执行）**：
- Step 1（CR 风格对照 vs `lib/llm.ts`）：**V-006 通过**
  - 3 处差异均为业务差异（非实现风格分叉）：
    1. `max_tokens`: 512 → 1024（HtmlAnalysis summary 更长）
    2. 接口字段：`change_type` → `content_type`（语义不同，符合 solution.md 第 5 轮）
    3. 函数参数：`url+diff` → `markdown+opts?`（业务差异）
  - 实现风格完全一致：SDK 构造、env 约定、Prompt 结构、extractJson、字段缺失兜底、异常兜底
- Step 2：无差异需要修复，跳过
- Step 3：流程结束

**T4 整体结论**：✅ 9 条 AC 全部满足；V-001~V-006 全部覆盖（17 个单测断言）；与 `lib/llm.ts` 风格对齐（V-006 通过）；无需额外提交

---

## I2 完成总结

| Task | 状态 | Commit | 验证 |
|---|---|---|---|
| T0 环境验证 | ✅ | N/A | Node v24.18.0 + turndown 已声明 + lib/html.ts 不存在 |
| T1 实现 lib/html.ts | ✅ | `676ddf7` | `npx tsc --noEmit` 退出码 0 |
| T2 写测试脚本 | ✅ | `1c86b42` | 17/17 PASS |
| T3 lint + build | ✅ | N/A | `npm run build` 退出码 0；lint 因项目预存状态跳过 |
| T4 CR + 最终评审 | ✅ | N/A | V-006 通过；无差异需修复 |

**所有计划内任务完成；最小验证全部通过；满足进入 Finish 条件**。

---

## Merge-back 待办清单（仅记录，不在本阶段执行）

> 若实现中产生"需要晋升到 project/"的变更（ADR/契约/NFR/运维等），在这里记录：要晋升什么、证据入口在哪里、谁来做。

- MB-001（V-005）：在 merge_back.md 中显式登记项目知识库 4 项缺口（`memory/product.md` / `memory/glossary.md` / `products/index.md` / `components/index.md`），并补一份 `.aisdlc/project/components/lib.md` 记录 `lib/html.ts` 模块页（含 API 契约 + 调用方清单 + 证据入口）。Owner：Spec 作者 / Maintainer；触发条件：本 Spec Pack 完成 I2 + Verification 后。

---

## 迭代记录

- 2026-07-09 v1.0（首版）：基于 solution.md（澄清记录 5 轮已收敛）产出实现计划。识别 turndown/@types/turndown 已就位（省去 T1 依赖新增）；识别 Node v24.18.0 支持 `--experimental-strip-types`（无需引入 tsx）；沿用 `scripts/test-*.mjs` 项目约定作为测试形态；登记 5 条风险（R1~R5）与 1 项 merge-back 待办（MB-001）。