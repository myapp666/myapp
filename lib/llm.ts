import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const baseURL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

const PROMPT_TMPL = `你是一位竞争情报分析师。请分析以下网页变更并输出 JSON。

URL: {url}

变更摘要（unified diff，最多 2000 字符）:
{diff}

请只输出合法 JSON，格式如下（不要包含 markdown 代码块）:
{
  "change_type": "价格变动|产品更新|促销活动|页面重构|内容更新|其他",
  "summary": "简短描述变更内容（中文，100字以内）",
  "importance": "低|中|高"
}`;

export interface ChangeAnalysis {
  change_type: string;
  summary: string;
  importance: string;
}

export async function analyzeChange(url: string, diff: string): Promise<ChangeAnalysis> {
  const diffSummary = diff.slice(0, 2000) || '（无差异）';
  const prompt = PROMPT_TMPL.replace('{url}', url).replace('{diff}', diffSummary);

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (resp.content[0] as { type: string; text: string }).text.trim();
    return JSON.parse(text) as ChangeAnalysis;
  } catch (err) {
    return {
      change_type: '',
      summary: `[AI 解读失败，原因: ${err}]`,
      importance: '',
    };
  }
}