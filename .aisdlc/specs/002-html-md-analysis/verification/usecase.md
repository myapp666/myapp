---
title: 002-html-md-analysis 测试用例（Usecase）
status: ready
version: v1.0
date: 2026-07-09
---

# 测试用例（Usecase）— 002-html-md-analysis

> 把 `requirements/solution.md §8 Mini-PRD`（AC-1~AC-9）与 §5 验证清单（V-001~V-006）转成可执行、可判定、可追溯的手工用例。
> **口径基准（重要）**：AC-5 / AC-6 的兜底期望值以 `verification/test-plan.md` v1.1 §8.1 的 **as-built 口径**为准 —— `content_type="其他"` / `importance="低"` / `summary=""`（缺字段）或 `"[AI 解读失败, 原因: ...]"`（异常）。**不得**照抄 solution.md §8 AC-5 / §5 V-002 里类型非法的 `content_type=""` / `importance=""`（见 test-plan R8）。
>
> 追溯入口：
> - [requirements/solution.md §8 Mini-PRD](../requirements/solution.md)（AC-1~AC-9）
> - [requirements/solution.md §5 验证清单](../requirements/solution.md)（V-001~V-006）
> - [verification/test-plan.md](./test-plan.md)（范围/策略/准入准出/R8 口径订正）
>
> 执行结果与缺陷引用以 `verification/report-*.md` 为准；本文件的「状态/执行历史/缺陷 ID」字段仅作对齐占位。

---

## 0. 执行前置（全局）

- [ ] Node ≥ v22.6（支持 `--experimental-strip-types`）；实测环境 v24.18.0
- [ ] 仓库根：`d:\project\myapp`（Next.js 15 单体，无 `.gitmodules`）
- [ ] `lib/html.ts`、`scripts/test-html.mts` 已提交且工作区无改动（commit `676ddf7` / `1c86b42`）
- [ ] `turndown` / `@types/turndown` 已在 `package.json`
- [ ] mock SDK 内联于 `scripts/test-html.mts`，通过 `process.env.MOCK_AI_MODE`（`ok` / `throw` / `bad_json` / `missing_summary` / `truncation`）切换行为
- [ ] 无需真实 `AI_API_KEY`（P0/P1 全部走 mock）

> **统一执行入口**：多数用例可由单条命令一次性覆盖 —— `node --experimental-strip-types scripts/test-html.mts`（输出 `PASS: N / FAIL: 0` + 退出码 0）。各 TC 的「测试步骤」额外给出可独立复现的最小片段/命令，便于定位单点失败。

---

## 1. AC → 用例覆盖矩阵（DoD：覆盖关系明确）

| AC / V | 描述 | 覆盖用例 | 优先级 |
|---|---|---|---|
| AC-1 | 标准 HTML → GFM Markdown（ATX 标题） | TC-FUNC-001 | P0 |
| AC-2 | 空字符串 → `""` | TC-FUNC-002 | P0 |
| AC-3 | 纯文本无标签 → 原文本 | TC-FUNC-003 | P0 |
| AC-4 | mock 合法 JSON → 字段完全匹配 | TC-INT-004 | P0 |
| AC-5 | SDK 抛错 → 兜底（as-built `其他`/`低`） | TC-FUNC-005 | P0 |
| AC-6 | 缺字段 → `summary=""` + 其余兜底 | TC-FUNC-006 | P0 |
| AC-7 | 输入 >15000 → 截断 + 正常返回 | TC-FUNC-007 | P1 |
| AC-8 | TS 严格模式编译通过 | TC-REG-008 | P0 |
| AC-9 | `package.json` 依赖分类正确 | TC-REG-009 | P1 |
| V-001 | turndown 5 类异常输入不抛错 | TC-FUNC-010 | P0 |
| V-002 | AI 5 类异常兜底 | TC-FUNC-005 / TC-FUNC-006 / TC-FUNC-011 | P0 |
| V-003 | 超长截断 | TC-FUNC-007 | P1 |
| V-004 | `opts.readability?` 类型签名保留 | TC-REG-012 | P2 |
| V-005 | 项目知识库补齐 | 非本次执行（merge-back MB-001，见备注） | — |
| V-006 | 与 `lib/llm.ts` 风格一致 | TC-REG-013（CR 检查单） | P2 |
| smoke | 端到端脚本 + 编译健康 | SMOKE-001 | P0 |

---

## TC-FUNC-001: cleanHtmlToMarkdown - 标准 HTML → GFM Markdown

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 3 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 `cleanHtmlToMarkdown` 把标准 HTML（含标题/段落）转为 GFM Markdown，且标题走 **ATX** 风格（`# Hello` 而非 setext）。这是模块最核心的正向路径（AC-1）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `lib/html.ts` 导出 `cleanHtmlToMarkdown`
- [ ] `TurndownService({ headingStyle: 'atx' })` 已配置（`lib/html.ts:14`）

---

### 测试步骤

1. **调用 `cleanHtmlToMarkdown` 传入标准 HTML**
   - 输入：`"<h1>Hello</h1><p>World</p>"`
   - **预期：** 返回值严格等于 `"# Hello\n\nWorld"`（ATX 标题 + 段落间空行）

2. **对含表格/代码/链接/图片的 HTML 执行转换**
   - 输入：`"<table>...</table>"` / `"<code>x</code>"` / `"<a href>"` / `"<img>"` 各一例
   - **预期：** 输出为对应 GFM 语法（`| |`、`` `x` ``、`[..](..)`、`![..](..)`），不抛异常

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 输入 HTML | `<h1>Hello</h1><p>World</p>` | AC-1 基准断言 |
| 期望输出 | `# Hello\n\nWorld` | ATX 风格；换行为 `\n` |

**测试账号：** N/A（纯函数 lib，无账号维度）

---

### 后置条件

- 无副作用（纯函数，无 IO/无网络/无临时文件）

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 多级标题 | `<h2>A</h2>` | `## A`（ATX） |
| 嵌套结构 | `<ul><li>x</li></ul>` | `- x` |
| 内联样式 | `<b>x</b>` | `**x**` |

---

### 关联测试用例

- TC-FUNC-002：空串边界
- TC-FUNC-010：异常输入不抛错（V-001）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

AC-1 曾在 T2 暴露 bug：turndown 默认 h1 用 setext（`Hello\n=====`），已通过 `headingStyle: 'atx'` 修复（commit `1c86b42`）。

---

## TC-FUNC-002: cleanHtmlToMarkdown - 空字符串

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 1 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证空字符串输入返回 `""` 且不抛异常（AC-2，V-001 边界）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）

---

### 测试步骤

1. **调用 `cleanHtmlToMarkdown("")`**
   - 输入：`""`
   - **预期：** 返回严格等于 `""`（空字符串），无异常抛出

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 输入 | `""` | 短路分支：`html ? turndown(html) : ''` |
| 期望 | `""` | — |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 纯空白 | `"   "` | 返回字符串（不抛错） |
| 仅换行 | `"\n"` | 返回字符串（不抛错） |

---

### 关联测试用例

- TC-FUNC-003：纯文本
- TC-FUNC-010：异常输入矩阵

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

对应 `lib/html.ts` 空串短路逻辑；属 smoke 基础断言之一。

---

## TC-FUNC-003: cleanHtmlToMarkdown - 纯文本无标签

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 1 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证不含任何 HTML 标签的纯文本原样返回，不抛异常（AC-3，V-001 边界）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）

---

### 测试步骤

1. **调用 `cleanHtmlToMarkdown("纯文本无标签")`**
   - 输入：`"纯文本无标签"`
   - **预期：** 返回严格等于 `"纯文本无标签"`，无异常

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 输入 | `纯文本无标签` | 无标签中文串 |
| 期望 | `纯文本无标签` | 原样返回 |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 含 Markdown 特殊字符 | `"a*b_c"` | 不误转义为断裂结构（可接受 turndown 默认行为） |

---

### 关联测试用例

- TC-FUNC-002：空串
- TC-FUNC-010：异常输入矩阵

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

smoke 基础断言之一。

---

## TC-INT-004: analyzeHtml - mock 返回合法 JSON

**优先级：** P0（关键）
**类型：** 集成
**状态：** 未执行
**预估时间：** 4 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 `analyzeHtml` 在 mock Anthropic SDK 返回合法 JSON 时，`extractJson` 正确解析并返回字段完全匹配的 `HtmlAnalysis`（AC-4，V-002 正向）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `MOCK_AI_MODE=ok`（mock 返回合法三字段 JSON）

---

### 测试步骤

1. **设 mock 返回合法 JSON 并调用 `analyzeHtml`**
   - 输入：markdown `"# 标题\n正文"`；mock 返回 `{"content_type":"文章","summary":"...","importance":"中"}`
   - **预期：**
     - 返回对象 `content_type === "文章"`
     - `summary` 与 mock 一致
     - `importance === "中"`
     - 不抛异常

---

### 数据验证

| 字段 | 源值（mock） | 转换后值（返回） | 状态 |
|------|------|----------|------|
| content_type | `文章` | `文章` | [ ] |
| summary | `<mock 文本>` | 同源值 | [ ] |
| importance | `中` | `中` | [ ] |

---

### 异常场景

- [ ] 见 TC-FUNC-005（抛错）/ TC-FUNC-006（缺字段）/ TC-FUNC-011（超时·非 JSON）

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| MOCK_AI_MODE | `ok` | 合法 JSON |

**测试账号：** N/A

---

### 后置条件

- 无副作用（mock 无真实网络）

---

### 关联测试用例

- TC-FUNC-005 / TC-FUNC-006 / TC-FUNC-011（V-002 反向矩阵）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

`analyzeHtml` 三字段兜底逻辑见 `lib/html.ts:135-139`（parsed 优先，缺失走 `其他`/`低`/`""`）。

---

## TC-FUNC-005: analyzeHtml - SDK 抛错兜底（as-built 口径）

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 4 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 `analyzeHtml` 在 SDK 抛错（如 500）时，返回 **类型合法的兜底结构体**、`summary` 以 `[AI 解读失败` 开头，且**不向调用方抛错**（AC-5，V-002）。**此用例是 R8 口径订正的关键校验点。**

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `MOCK_AI_MODE=throw`（mock 抛 500）

---

### 测试步骤

1. **令 mock SDK 抛错并调用 `analyzeHtml`**
   - 输入：任意合法 markdown；mock `messages.create` 抛 500
   - **预期（as-built，权威）：**
     - `content_type === "其他"`（**非** `""`；`""` 不在类型联合内）
     - `summary` 以 `"[AI 解读失败"` 开头（含 `原因: ...`）
     - `importance === "低"`（**非** `""`）
     - 调用方**未**收到异常（Promise resolve 而非 reject）

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| MOCK_AI_MODE | `throw` | 模拟 SDK 500 |
| 期望 content_type | `其他` | 类型合法兜底（R8） |
| 期望 importance | `低` | 类型合法兜底（R8） |
| 期望 summary 前缀 | `[AI 解读失败` | `lib/html.ts:143` |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 非 Error 抛出 | mock throw 字符串 | `原因: <String(err)>`，仍兜底 `其他`/`低` |
| 网络类错误 | mock reject | 同上兜底 |

---

### 关联测试用例

- TC-FUNC-006（缺字段兜底）
- TC-FUNC-011（超时 / 非 JSON）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

**口径冲突登记（R8）**：solution.md §8 AC-5 与 §5 V-002 信号写的是 `content_type=""` / `importance=""`，但 `HtmlAnalysis.content_type` 类型联合为 `"文章"|"产品页"|"文档"|"营销页"|"其他"`（不含 `""`）。真按 `""` 断言会 tsc 失败。**本用例以 `lib/html.ts:141-145` 的 as-built `其他`/`低` 为唯一正确期望值**；需订正 solution.md（见 test-plan R8）。

---

## TC-FUNC-006: analyzeHtml - JSON 缺字段兜底

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 3 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 mock 返回缺 `summary`（及缺其他字段）的 JSON 时，`analyzeHtml` 按字段独立兜底：`summary=""`、缺失的 `content_type`→`其他`、缺失的 `importance`→`低`（AC-6，V-002）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `MOCK_AI_MODE=missing_summary`（mock 返回 `{"content_type":"文章"}`）

---

### 测试步骤

1. **令 mock 返回仅含 `content_type` 的 JSON 并调用 `analyzeHtml`**
   - 输入：合法 markdown；mock 返回 `{"content_type":"文章"}`
   - **预期：**
     - `content_type === "文章"`（存在字段正常填充）
     - `summary === ""`（缺字段兜底空串）
     - `importance === "低"`（缺字段兜底，as-built）

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| MOCK_AI_MODE | `missing_summary` | 缺 summary/importance |
| 期望 summary | `""` | `lib/html.ts:137` |
| 期望 importance | `低` | `lib/html.ts:138` 兜底 |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 全字段缺失 | `{}` | `content_type=其他` / `summary=""` / `importance=低` |
| 缺 content_type | `{"summary":"x","importance":"高"}` | `content_type=其他`，其余原样 |

---

### 关联测试用例

- TC-FUNC-005（抛错兜底）
- TC-INT-004（正向合法 JSON）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

`summary` 兜底为 `""`（与 `lib/llm.ts` ChangeAnalysis 风格一致）；`content_type`/`importance` 兜底为类型合法枚举 `其他`/`低`（见 R8）。

---

## TC-FUNC-007: analyzeHtml - 超长输入截断

**优先级：** P1（高）
**类型：** 功能
**状态：** 未执行
**预估时间：** 4 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证输入 markdown > 15000 字符时，截断到 15000 并在 prompt 中追加截断提示，`analyzeHtml` 仍正常返回合法 `HtmlAnalysis`（AC-7，V-003）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `MOCK_AI_MODE=truncation` 或 `ok`（可捕获实际发送的 prompt body）

---

### 测试步骤

1. **构造 20000 字符 markdown（如重复字母 `A`）并调用 `analyzeHtml`**
   - 输入：`"A".repeat(20000)`
   - **预期：**
     - 实际发送给 mock 的 prompt 含截断提示文案（如"已截断"/"最多 15000 字符"语义）
     - prompt 中**不含**未截断的完整 20000 长串（即出现的 `A` 段被切到 ≤15000）
     - 返回合法 `HtmlAnalysis`（`content_type` 属枚举、无异常）

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 输入长度 | 20000 字符 | > `MAX_INPUT_CHARS=15000`（`lib/html.ts:44`） |
| 截断点 | 15000 | `markdown.slice(0, 15000)`（`lib/html.ts:121`） |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 恰好 15000 | `"A".repeat(15000)` | 不截断（`>` 严格判定），无截断提示 |
| 15001 | `"A".repeat(15001)` | 截断到 15000 + 截断提示 |
| 远小于上限 | 100 字符 | 不截断，prompt 无截断提示 |

---

### 关联测试用例

- TC-INT-004（正向 analyzeHtml）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

截断提示通过 `{truncation_notice}` 占位注入 prompt（`lib/html.ts:118-124`）；T2 曾因"第二个 mock server 切换失败"改为在主 server 捕获 body（commit `1c86b42`）。

---

## TC-REG-008: TypeScript 严格模式编译

**优先级：** P0（关键）
**类型：** 回归
**状态：** 未执行
**预估时间：** 2 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 `lib/html.ts` 在 TypeScript 严格模式下编译通过、无 `any` 泄漏（AC-8）。这是 R8 的隐含守门：任何把兜底改回 `""` 的改动都会在此失败。

---

### 背景

可能影响本项：`lib/html.ts` 兜底口径、`HtmlAnalysis` 类型联合、`extractJson` 类型断言。

---

### 关键路径测试

1. [ ] `npx tsc --noEmit` 退出码 0
2. [ ] 无 TS 报错输出
3. [ ] `HtmlAnalysis.content_type` 联合不含 `""`（若代码把兜底写成 `""` 会编译失败 → 反向守门 R8）

---

### 集成点

- [ ] `@types/turndown` 已就位，`import TurndownService from 'turndown'` 类型可解析
- [ ] `@types/node` 已就位（`process.env` 类型可解析）

---

### 性能基线

- 预期编译时间：本机 < 30 秒

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

命令：`npx tsc --noEmit`（在仓库根）。v1.1 复核已实测退出码 0。

---

## TC-REG-009: package.json 依赖分类

**优先级：** P1（高）
**类型：** 回归
**状态：** 未执行
**预估时间：** 2 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 `turndown` 在 `dependencies`、`@types/turndown` 在 `devDependencies`，分类正确（AC-9）。

---

### 背景

近期变更：新增 `turndown` runtime 依赖 + `@types/turndown` dev 依赖。

---

### 关键路径测试

1. [ ] `package.json` `dependencies` 含 `"turndown": "^7.2.4"`
2. [ ] `package.json` `devDependencies` 含 `"@types/turndown": "^5.0.6"`
3. [ ] `git diff package-lock.json` 无非预期漂移（turndown 已声明，本次未触发变更）

---

### 集成点

- [ ] Vercel Node 运行时可解析 turndown（纯 JS，无 native 绑定）

---

### 性能基线

- N/A

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

验证命令：`grep -n "turndown" package.json`。v1.1 复核已确认两项均在位。

---

## TC-FUNC-010: cleanHtmlToMarkdown - 异常输入矩阵（V-001）

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 5 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 5 类异常/边界输入下 `cleanHtmlToMarkdown` 全部返回字符串（空串或合法 MD），**绝不抛异常**（V-001）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）

---

### 测试步骤

1. **依次对 5 类输入调用 `cleanHtmlToMarkdown`**
   - **预期：** 每类均返回 `typeof === "string"`，无 throw

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 空字符串 | `""` | `""`，不抛错 |
| 纯文本 | `"纯文本无标签"` | 原文本，不抛错 |
| 未闭合标签 | `"<p>未闭合"` | 返回字符串（合法 MD 或原文），不抛错 |
| 内嵌 script | `"<script>alert(1)</script>正文"` | 返回字符串（script 内容按 turndown 规则处理），不抛错 |
| emoji + 中文长串 | `"😀中文……"`（较长） | 返回字符串，不抛错，不乱码 |

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 输入类别 | 5 类（见上表） | try/catch 兜底返回 `""`（`lib/html.ts`） |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 关联测试用例

- TC-FUNC-001 / 002 / 003（正向与空串/纯文本）

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

对应 `scripts/test-html.mts` 中 V-001 的 5 类断言（含在 17/17 内）。

---

## TC-FUNC-011: analyzeHtml - AI 异常矩阵补充（超时 / 非 JSON）

**优先级：** P0（关键）
**类型：** 功能
**状态：** 未执行
**预估时间：** 4 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

补齐 V-002 中 TC-FUNC-005/006 未直接覆盖的两类异常：**超时** 与 **模型返回非 JSON 文本**，验证均走兜底而不抛错。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）
- [ ] `MOCK_AI_MODE=bad_json`（非 JSON 文本）；另用超时 mock 覆盖超时分支

---

### 测试步骤

1. **mock 返回非 JSON 文本（如 `"这不是JSON"`）并调用 `analyzeHtml`**
   - **预期：** `extractJson` 无法解析 → 走缺字段/异常兜底 → 返回合法 `HtmlAnalysis`（`content_type=其他` / `importance=低`），不抛错

2. **mock 模拟超时（reject/挂起后错误）并调用**
   - **预期：** 命中 `catch` 分支 → `summary` 以 `[AI 解读失败` 开头，`其他`/`低` 兜底

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| MOCK_AI_MODE | `bad_json` | 非 JSON 文本 |
| 超时 | mock reject | catch 分支 |

**测试账号：** N/A

---

### 后置条件

- 无副作用

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| 带 ```json 围栏 | ` ```json\n{...}\n``` ` | `extractJson` 剥离围栏后正常解析 |
| JSON 前后有噪声 | `"垃圾{...}垃圾"` | 提取最外层 `{...}` 后解析 |

---

### 关联测试用例

- TC-FUNC-005 / TC-FUNC-006

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

`extractJson` 与 `lib/llm.ts` 同款（剥离围栏 + 找最外层 `{...}`）。

---

## TC-REG-012: opts.readability 类型签名保留（V-004）

**优先级：** P2（中）
**类型：** 回归
**状态：** 未执行
**预估时间：** 2 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

验证 v2 增量入口 `opts.readability?: boolean` 形参签名存在（仅类型，不实现），调用方传该参数不破坏现有行为（默认走 turndown）（V-004）。

> 注：solution.md §8 Mini-PRD 的 `analyzeHtml` 签名为 `opts?: { prompt?: string }`。**执行前需先与实现核对** `opts` 是否已含 `readability?: boolean`；若未含，判 Blocked 并回写 report（V-004 为"预留签名"，属可接受的 conditional 项，见 test-plan §8.3）。

---

### 关键路径测试

1. [ ] TS 编译下 `analyzeHtml(md, { readability: true })` 若签名存在则类型通过；若签名未预留则记为 Blocked（非阻断交付）
2. [ ] 传 `readability` 不改变默认 turndown 行为

---

### 集成点

- [ ] 不引入 `@mozilla/readability` / `jsdom`（Out of Scope）

---

### 性能基线

- N/A

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

V-004 触发条件 = 出现 ≥1 个非 001 模块需要正文提取（v2）；本次仅校验签名不破坏现有行为。

---

## TC-REG-013: 与 lib/llm.ts 风格一致性（V-006 CR 检查单）

**优先级：** P2（中）
**类型：** 回归
**状态：** 未执行
**预估时间：** 6 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

以 CR 检查单形式验证 `lib/html.ts` 与 `lib/llm.ts` 在 SDK 构造 / env 约定 / prompt 结构 / `extractJson` / 字段缺失兜底 / 异常兜底 6 个维度实现风格一致（V-006）。

---

### 背景

近期变更：新增 `lib/html.ts`，参照 `lib/llm.ts` 复用防御性解析与兜底模式。

---

### 关键路径测试（逐项 CR）

1. [ ] SDK 客户端构造与 env 读取一致（`AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`）
2. [ ] `extractJson` 逻辑一致（剥离 ```json 围栏 + 找最外层 `{...}`）
3. [ ] 字段缺失兜底一致（缺失字段返回合法默认，不抛错）
4. [ ] 异常兜底一致（catch → 返回合法结构体，`summary` 前缀标记失败）
5. [ ] 允许的业务差异已记录：`max_tokens` 512→1024、字段名 `change_type`→`content_type`、参数 `url+diff`→`markdown+opts?`

---

### 集成点

- [ ] `lib/html.ts` **不** import `lib/llm.ts`（避免循环依赖，仅风格参照）

---

### 性能基线

- N/A

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| | | | | | |

---

### 备注

T4 CR 已通过（3 处均为业务差异，非实现风格分叉）。

---

## SMOKE-001: 端到端脚本 + 编译健康

**优先级：** P0（关键）
**类型：** 冒烟
**状态：** 未执行
**预估时间：** 3 分钟
**创建日期：** 2026-07-09
**最后更新：** 2026-07-09

---

### 目标

一条命令快速确认构建可用、关键路径可跑通：`scripts/test-html.mts` 全绿 + TS 严格编译通过。任一失败即阻断后续回归（test-plan §5.1）。

---

### 前置条件

- [ ] 全局执行前置已满足（§0）

---

### 测试步骤

1. **运行测试脚本**
   - Run：`node --experimental-strip-types scripts/test-html.mts`
   - **预期：** 输出 `PASS: 17 / FAIL: 0`，退出码 0

2. **TS 严格编译**
   - Run：`npx tsc --noEmit`
   - **预期：** 退出码 0，无报错

3. **（可选）仓库构建**
   - Run：`npm run build`
   - **预期：** 退出码 0，27 个现有路由构建成功，新模块被消费

---

### 测试数据

| 字段 | 值 | 备注 |
|------|-----|------|
| 断言总数 | 17 | 覆盖 AC-1~AC-7 + V-001~V-003 |

**测试账号：** N/A

---

### 后置条件

- 无副作用（无临时文件、无 DB、无网络）

---

### 边界与变体

| 变体 | 输入 | 预期结果 |
|------|------|----------|
| Node < 22.6 | — | `--experimental-strip-types` 不支持 → Blocked（升级 Node） |

---

### 关联测试用例

- 覆盖 TC-FUNC-001/002/003/005/006/007/010/011 的脚本化断言

---

### 执行历史

| 日期 | 执行人 | 构建版本 | 结果 | 缺陷 ID | 备注 |
|------|--------|----------|------|---------|------|
| 2026-07-09 | v1.1 复核 | `1c86b42` | 通过（17/17，tsc 0） | — | 见 test-plan §2 实测证据 |

---

### 备注

阻断规则：任一 smoke 断言失败即判"不具备交付条件"。

---

## 2. CONTEXT GAP（如有）

- `CONTEXT GAP`：`.aisdlc/project/memory/product.md` / `tech.md` / `glossary.md` 整目录不存在 → 无法消费产品定位/技术栈/术语约束。对本用例集影响有限（纯函数 lib 的可测性不依赖这些），但下游若需业务语义级用例需先补齐（V-005 / MB-001）。
- **口径 GAP（R8，已在 test-plan v1.1 登记）**：solution.md §8 AC-5 与 §5 V-002 信号的 `content_type=""` / `importance=""` 与 `HtmlAnalysis` 类型联合冲突。**本用例集 TC-FUNC-005 / 006 一律以 as-built `其他`/`低` 为期望值**；待 solution.md 订正后本 GAP 关闭。
- `V-005` 非本次执行：项目知识库补齐属 merge-back（MB-001），不在 verification 阶段落地。

---

## 3. 迭代记录

- 2026-07-09 v1.0（首版）：基于 solution.md §8（AC-1~AC-9）+ §5（V-001~V-006）与 test-plan v1.1 产出 14 条用例（TC-FUNC×7 / TC-INT×1 / TC-REG×4 / SMOKE×1，含 V-004/V-006 检查单）；AC→用例覆盖矩阵完整；AC-5/AC-6 采用 R8 订正后的 as-built 口径（`其他`/`低`）。
