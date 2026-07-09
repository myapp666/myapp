import Anthropic from '@anthropic-ai/sdk';

// ---------- 公开类型 ----------

export type SuggestedCompetitor = {
  name: string;
  websiteUrl: string;
  industry: string;
  notes: string;
  suggestedPaths: string[];
};

export type SuggestInput = {
  productUrl?: string;
  productDescription?: string;
  industry?: string;
  count?: number;
};

export type SuggestOutput = {
  candidates: SuggestedCompetitor[];
};

// ---------- AI 通道（与 lib/llm.ts 同款孪生） ----------

const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const baseURL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

// ---------- 简化的 Prompt：直接问 LLM 给 N 条竞品 ----------
function buildPrompt(input: SuggestInput): { prompt: string; count: number } {
  const count = Math.max(1, Math.min(10, input.count ?? 5));

  // 三个文本 hint（全部可选；至少一个非空由调用方校验）
  const hints: string[] = [];
  if (input.productUrl?.trim()) hints.push(`用户产品 URL: ${input.productUrl.trim()}`);
  if (input.productDescription?.trim()) hints.push(`用户产品描述: ${input.productDescription.trim()}`);
  if (input.industry?.trim()) hints.push(`兜底行业: ${input.industry.trim()}`);
  const contextBlock = hints.length > 0 ? hints.join('\n') : '（用户提供了一些线索，但愿你能根据这些线索推断出产品方向）';

  const prompt = `请根据以下线索推荐 ${count} 条真实存在的潜在竞品。

${contextBlock}

只输出单个 JSON 对象,JSON 外不要任何文字、注释、markdown 围栏。schema:

{"candidates":[{"name":"公司或产品名","websiteUrl":"https://官方一级域名","industry":"行业标签","notes":"一句话定位","suggestedPaths":["/pricing","/blog","/changelog","/docs","/about","/customers","/product","/features"]}]}

要求:
- websiteUrl 必须 https:// 开头,必须是面向终端用户的官方一级域名
- name 不要带地区后缀或+变体
- notes 控制在 30-60 字,客观描述,不夹营销话术
- suggestedPaths 3-6 个,从该候选确实常见存在的页面里挑
- 若真实存在的同方向竞品不足 ${count},允许少给,严禁编造不存在的公司`;
  return { prompt, count };
}

// ---------- 防御性 JSON 解析 ----------
function extractJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('未在模型输出中找到 JSON 对象');
  return JSON.parse(match[0]);
}

// ---------- 单条候选规范化 ----------
// 字段缺失或非法 → 返回 null（候选丢弃，不抛）
function normalizeCandidate(raw: unknown, count: number): SuggestedCompetitor | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) return null;

  let websiteUrl = typeof r.websiteUrl === 'string' ? r.websiteUrl.trim() : '';
  if (!websiteUrl) return null;
  if (!/^https?:\/\//i.test(websiteUrl)) websiteUrl = `https://${websiteUrl}`;
  try {
    new URL(websiteUrl); // 至少能 parse;不再校验 hostname 必须含点（信 LLM）
  } catch {
    return null;
  }

  const industry = typeof r.industry === 'string' ? r.industry.trim() : '';
  const notes = typeof r.notes === 'string' ? r.notes.trim().slice(0, 200) : '';

  const suggestedPathsRaw = Array.isArray(r.suggestedPaths) ? r.suggestedPaths : [];
  const seen = new Set<string>();
  const suggestedPaths: string[] = [];
  for (const p of suggestedPathsRaw) {
    if (typeof p !== 'string') continue;
    const norm = p.trim();
    if (!norm.startsWith('/')) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    suggestedPaths.push(norm);
    if (suggestedPaths.length >= 6) break;
  }

  // 注意 count 仅用于判断是否停止取,不参与返回值
  void count;
  return { name, websiteUrl, industry, notes, suggestedPaths };
}

// ---------- 日志 ----------
function logSuggestion(reason: string, details?: Record<string, unknown>, err?: unknown): void {
  const kv = details
    ? ' ' + Object.entries(details).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
    : '';
  if (err) {
    console.warn(
      `[competitor-suggest] suggestCompetitors 异常 reason=${reason}${kv} err=${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  console.warn(`[competitor-suggest] suggestCompetitors 告警 reason=${reason}${kv}`);
}

// ---------- 主函数 ----------
/**
 * 直接让 LLM 推荐 N 条潜在竞品。
 * - 输入三个字段（URL / 描述 / 行业）至少一个非空，由调用方校验
 * - 不再爬取产品 URL（让 LLM 用知识回答，响应更快、不依赖任何外部网络）
 * - 任何异常兜底返 { candidates: [] }，与 lib/llm.ts::analyzeChange 同款
 */
export async function suggestCompetitors(input: SuggestInput): Promise<SuggestOutput> {
  const { prompt, count } = buildPrompt(input);

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (resp.content[0] as { type: string; text: string }).text.trim();

    const parsed = extractJson(text) as { candidates?: unknown };
    const rawList = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
    const candidates: SuggestedCompetitor[] = [];
    let dropped = 0;
    for (const raw of rawList) {
      const c = normalizeCandidate(raw, count);
      if (c) candidates.push(c);
      else dropped++;
      if (candidates.length >= count) break;
    }

    if (candidates.length === 0) {
      logSuggestion('empty-array', { rawCount: rawList.length, dropped });
    } else if (dropped > 0) {
      logSuggestion('partial-normalize-drop', { kept: candidates.length, dropped, rawCount: rawList.length });
    }

    return { candidates };
  } catch (err) {
    logSuggestion('api-error', undefined, err);
    return { candidates: [] };
  }
}
