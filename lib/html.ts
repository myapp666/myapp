import TurndownService from 'turndown';
import Anthropic from '@anthropic-ai/sdk';

// ---------- 公开类型 ----------

export interface HtmlAnalysis {
  content_type: '文章' | '产品页' | '文档' | '营销页' | '其他';
  summary: string;
  importance: '低' | '中' | '高';
}

// ---------- turndown 单例 ----------

const turndown = new TurndownService();

// ---------- 1) HTML → Markdown ----------

/**
 * 把任意 HTML 字符串转为 GFM Markdown。
 * - 纯函数；模块不持有任何 IO/异步副作用。
 * - 空字符串、纯文本（无标签）、含未闭合标签的 HTML 均返回字符串（不抛异常）。
 */
export function cleanHtmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return turndown.turndown(html);
  } catch {
    return '';
  }
}

// ---------- 2) AI 通道（与 lib/llm.ts 同款约定） ----------

const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const baseURL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

// 输入截断上限（V-003）
const MAX_INPUT_CHARS = 15000;

const PROMPT_TMPL = `你是网页内容分析助手，专责阅读 Markdown 文本并输出结构化分析结果。输出会被程序直接 JSON.parse 解析，必须严格遵守格式。

【硬性规则】
- 只输出单个合法 JSON 对象
- 禁止所有 markdown 符号：反引号代码块、井号标题、连字符列表、星号强调、大于号引用、方括号链接
- 禁止前后置文字：禁止"以下是""输出：""答案是"等引导语；禁止注释、空行、解释
- summary 字段值内禁止出现花括号 { }，否则会破坏 JSON 结构
- 任何违规都会让下游 JSON.parse 崩溃，必须绝对避免

【任务】
阅读下面的 Markdown 内容，回答三个层次的问题：
1. 这是什么类型的网页（content_type）
2. 这段内容讲了什么核心要点（summary）
3. 对一名普通读者来说重要性如何（importance）

【输入】
{truncation_notice}
Markdown 内容（最多 15000 字符）：
{markdown}

【输出 schema - 必须完全匹配】
{
  "content_type": "文章|产品页|文档|营销页|其他",
  "summary": "200-400 字中文摘要，客观描述内容主题与关键信息",
  "importance": "低|中|高"
}

【判断准则】
- content_type：5 选 1，最贴近的那一类
  - 文章：以叙事/观点为主的网页（博客、新闻、专栏）
  - 产品页：商品/服务的销售或介绍页（含价格、规格、CTA）
  - 文档：API/技术/操作说明类（带目录、代码块、步骤）
  - 营销页：品牌宣传、活动落地页（重视觉与情感号召）
  - 其他：不属于以上四类的兜底
- summary：客观描述内容主题 + 关键信息点，不做评价；200-400 字
- importance：高 = 含明确行动建议或强观点；中 = 有信息密度；低 = 套话/水内容/无可执行信息
- 若输入为空或乱码：content_type=其他，summary="[无法分析]",importance=低

【正例 - 必须照此格式输出】
{"content_type":"文章","summary":"本文介绍 Next.js 15 的 Server Actions 功能，对比传统 API Routes 的优势，给出 3 个落地场景与代码示例。核心观点是 Server Actions 能减少样板代码并自动处理表单状态。","importance":"中"}

【反例 - 绝对不要】
错误1：用三个反引号加 json 把 JSON 整段包起来
错误2：前面写"以下是分析结果"再跟 JSON
错误3：用井号当标题加连字符列表组织内容
错误4：把 content_type 写成"产品介绍""博客文章"等不在 5 选 1 内的值`;

/**
 * 防御性 JSON 解析：即便模型偶尔不听话输出 markdown 包装或前后置文字，也能兜底解析。
 * 移植自 lib/llm.ts 的 extractJson 风格。
 */
function extractJson(text: string): unknown {
  let cleaned = text.trim();
  // 去掉首尾的 ```json / ``` 围栏（不区分大小写）
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  // 在剩余文本中找最外层 {...}，容忍前后置文字
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('未在模型输出中找到 JSON 对象');
  return JSON.parse(match[0]);
}

/**
 * 把 Markdown 字符串喂给 Claude 输出 HtmlAnalysis。
 * - 复用 lib/llm.ts 的 Anthropic SDK + env 约定
 * - 超长输入（>15000 字符）走 V-003 截断策略
 * - 任何异常（解析失败/超时/缺字段）兜底返回合法结构体，不向调用方抛错
 */
export async function analyzeHtml(
  markdown: string,
  opts?: { prompt?: string }
): Promise<HtmlAnalysis> {
  const truncationNotice =
    markdown.length > MAX_INPUT_CHARS
      ? `[输入已截断至 ${MAX_INPUT_CHARS} 字符，原文 ${markdown.length} 字符]`
      : '';
  const truncated = markdown.length > MAX_INPUT_CHARS ? markdown.slice(0, MAX_INPUT_CHARS) : markdown;

  const basePrompt = opts?.prompt ?? PROMPT_TMPL;
  const prompt = basePrompt.replace('{truncation_notice}', truncationNotice).replace('{markdown}', truncated);

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (resp.content[0] as { type: string; text: string }).text.trim();
    const parsed = extractJson(text) as Partial<HtmlAnalysis>;
    // 字段缺失兜底（与 lib/llm.ts 的 ChangeAnalysis 风格一致）
    return {
      content_type: (parsed.content_type as HtmlAnalysis['content_type']) ?? ('其他' as HtmlAnalysis['content_type']),
      summary: parsed.summary ?? '',
      importance: (parsed.importance as HtmlAnalysis['importance']) ?? ('低' as HtmlAnalysis['importance']),
    };
  } catch (err) {
    return {
      content_type: '其他',
      summary: `[AI 解读失败, 原因: ${err instanceof Error ? err.message : String(err)}]`,
      importance: '低',
    };
  }
}