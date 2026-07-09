清洗html 为markdown 再给AI分析

## 澄清记录

### 第 1 轮：与 001 的关系 + 落地形态

**本轮结论**：
- 独立 Spec Pack，**不**复用/修改 001-competitor-tracking 的代码与数据模型
- 落地为新建前端模块 `lib/html.ts`（当前不存在，属于"补位"新建）
- 后续由 `lib/llm.ts` 风格约束：纯函数 + 类型导出 + 调用 Anthropic SDK（`AI_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`）
- 不引入后端 API、不改数据库 schema、不动 001 的采集链路

**本轮新增约束**：
1. 模块位置：`lib/html.ts`（与 `lib/scraper.ts` / `lib/llm.ts` 同级）
2. AI 调用复用 Anthropic SDK 与 `ANTHROPIC_*` 环境变量约定
3. 遵循项目 `lib/*.ts` 既有约定：纯函数、显式类型导出、错误兜底返回
4. 001 现有代码与数据库**不在本次改动范围**

**关键决策**：定位 → 独立 Spec Pack + 新建 `lib/html.ts`；AI 通道 → 复用 Anthropic SDK 与现有 env 约定

**遗留歧义**：清洗范围与目标 MD 风格未确定 → V-002 / V-003；AI 分析契约（输入分块、输出 schema）未确定 → V-004

### 第 2 轮：HTML 输入来源

**本轮结论**：
- `lib/html.ts` 仅接收**字符串参数**作为输入（`html: string`）
- 不读文件、不抓 URL、不持有任何 IO/异步副作用
- 由调用方负责把"任意来源"转成字符串后再传入，保证模块最高内聚与可测性

**本轮新增约束**：
1. 公开 API 形如：`cleanHtmlToMarkdown(html: string): string`、`analyzeHtml(html: string, opts?): Promise<AnalysisResult>`
2. 模块内不引用 `fs` / `fetch` / `lib/scraper.ts`，所有 IO 由调用方处理
3. 单测可直接传固定字符串断言输出，无需 mock 文件系统或网络

**关键决策**：输入契约 → `string` 入参；模块边界 → 纯函数 / 无 IO

**遗留歧义**：AI 分析契约（输入分块策略、输出 schema、可配置项）未确定 → V-004

### 第 3 轮：清洗范围

**本轮结论**：
- 采用 **turndown.js**（行业标准 HTML → Markdown 转换库）作为核心引擎
- 保留 h1-h6 / ul / ol / table / code / link / img 等结构；不做 readability 正文提取（MVP 范围内不引入第二种清洗路径）
- turndown 默认输出即 GFM（GitHub Flavored Markdown），与 Markdown 目标风格问题一并解决

**本轮新增约束**：
1. 新增依赖：`turndown`（runtime）+ `@types/turndown`（dev）
2. 公开 API：`cleanHtmlToMarkdown(html: string): string`，内部 `new TurndownService().turndown(html)`
3. 处理异常输入：非法字符串、空字符串、纯文本（无标签）必须给出可预测输出，不抛未捕获异常
4. 不在本轮引入 `@mozilla/readability`、jsdom 或正则剥离等替代方案

**关键决策**：清洗引擎 → turndown；目标 MD 风格 → GFM（turndown 默认）；MVP 范围不引入第二种清洗路径

**遗留歧义**：JSON 输出字段细节（是否含 sentiment / topics / 字段粒度）未确定 → V-004

### 第 4 轮：AI 分析契约

**本轮结论**：
- **整篇一次性**输入：把 turndown 输出整体喂给 Claude（**不做**分块）
- **严格 JSON 结构化输出**：模型必须输出可被 `JSON.parse` 解析的 JSON 对象
- 复用 `lib/llm.ts` 的"防御性 JSON 解析"模式（剥离 ```json 围栏、找最外层 `{...}`、字段缺失兜底）

**本轮新增约束**：
1. `analyzeHtml(html: string, opts?: { prompt?: string }): Promise<HtmlAnalysis>`，opts.prompt 缺省走内置默认 prompt
2. `HtmlAnalysis` interface 至少包含 `summary: string`；MVP 阶段字段集由本轮末次澄清固化
3. 任何模型输出异常（解析失败 / 超时 / 缺字段）必须兜底返回合法结构体，不抛异常给调用方（与 `lib/llm.ts` 风格一致）
4. 超长输入：截断到模型上下文安全上限（如 15000 字符），截断策略记入 V-005
5. 不在本 MVP 引入分块 / 多轮调用 / streaming

**关键决策**：输入策略 → 整篇一次性；输出约束 → 严格 JSON；复用防御性解析模式；不分块、不流式

### 第 5 轮：JSON 输出字段集（沿用 `lib/llm.ts` 的 ChangeAnalysis 模式）

**本轮结论**：
- 沿用 `ChangeAnalysis` 的扁平 3 字段结构 + 字段缺失兜底 + 防御性 JSON 解析
- `HtmlAnalysis` interface 重新命名为业务语义：
  ```ts
  interface HtmlAnalysis {
    content_type: "文章" | "产品页" | "文档" | "营销页" | "其他";
    summary: string;     // 200-400 字中文摘要
    importance: "低" | "中" | "高";
  }
  ```
- 字段缺失兜底：`content_type` / `importance` 缺省为 `""`（与 `ChangeAnalysis` 一致）；`summary` 缺省为 `"[AI 解读失败]"`
- 不引入 `sentiment` / `topics` / `key_points` 等扩展字段（MVP 不过度设计，后续按需 v2 增量）

**本轮新增约束**：
1. `analyzeHtml` 内置 prompt 模板显式约束中文输出、`content_type` 5 选 1、`importance` 3 选 1
2. 缺字段兜底策略：见 `lib/llm.ts` 的 `analyzeChange` 实现作为参照
3. `HtmlAnalysis` 与 `ChangeAnalysis` 是不同 interface，不可互相赋值或替换

**关键决策**：JSON schema → `content_type` / `summary` / `importance` 三字段；沿用 ChangeAnalysis 兜底与解析模式