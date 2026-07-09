import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const baseURL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

const PROMPT_TMPL = `你是竞争情报分析师，专责解读竞品网站变更。你的输出会被程序直接 JSON.parse 解析，必须严格遵守格式。

【硬性规则】
- 只输出单个合法 JSON 对象
- 禁止所有 markdown 符号：反引号代码块、井号标题、连字符列表、星号强调、大于号引用、方括号链接
- 禁止前后置文字：禁止"以下是""输出：""答案是"等引导语；禁止注释、空行、解释
- summary 字段值内禁止出现花括号 { }，否则会破坏 JSON 结构
- 任何违规都会让下游 JSON.parse 崩溃，必须绝对避免

【任务】
阅读下面的 unified diff，回答四个层次的问题：
1. 竞品做了什么变更（事实层）
2. 竞品为什么这么做（动机层）
3. 我们应该采取什么具体动作（动作层）
4. 为什么要采取这个动作，不做会怎样（论证层）

【输入】
URL: {url}
变更摘要（unified diff，最多 2000 字符）:
{diff}

【输出 schema - 必须完全匹配】
{
  "change_type": "价格变动|产品更新|促销活动|页面重构|内容更新|其他",
  "summary": "四段式标注：【变更】xxx【意图】xxx【行动】xxx【理由】xxx",
  "importance": "低|中|高"
}

【判断准则】
- change_type：6 选 1，最贴近的那一类
- summary：四段式标注，每段 30-80 字，合计 150-350 字
  - 【变更】客观描述发生了什么（事实层，含具体数字/事实）
  - 【意图】分析竞品为什么这么做（动机层，从商业策略/用户运营等角度）
  - 【行动】我们应该采取的具体动作，动词开头，可直接执行（动作层）
  - 【理由】为什么这个动作有效 / 不做的后果 / 预期收益（论证层，给出量化依据或紧迫性说明）
- importance：高 = 影响营收/价格/核心商业策略；中 = 影响功能体验/产品定位；低 = 纯样式/排版

【正例 - 必须照此格式输出】
{"change_type":"价格变动","summary":"【变更】竞品将会员套餐从 99 元/月降至 79 元/月，降幅 20%。【意图】通过价格战抢流失用户，意在提升续费率和市占。【行动】本周内评审我方定价策略，准备对应降价方案或推出对标低价套餐。【理由】竞品降价会拉走价格敏感用户，若不及时响应预计流失 5-10% 付费用户，月损 30-50 万营收","importance":"高"}

【反例 - 绝对不要】
错误1：用三个反引号加 json 把 JSON 整段包起来
错误2：前面写"以下是分析结果"再跟 JSON
错误3：用井号当标题加连字符列表组织内容
错误4：只写了【变更】【意图】却漏掉【行动】【理由】，或四段缺一不可`;

export interface ChangeAnalysis {
  change_type: string;
  summary: string;
  importance: string;
}

// 防御性 JSON 解析：即便模型偶尔不听话输出 markdown 包装或前后置文字，也能兜底解析。
function extractJson(text: string): unknown {
  let cleaned = text.trim();
  // 去掉首尾的 ```json / ``` 围栏（不区分大小写）
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  // 在剩余文本中找最外层 {...}，容忍前后置文字
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('未在模型输出中找到 JSON 对象');
  return JSON.parse(match[0]);
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
    const parsed = extractJson(text) as Partial<ChangeAnalysis>;
    // 字段缺失兜底
    return {
      change_type: parsed.change_type ?? '',
      summary: parsed.summary ?? '',
      importance: parsed.importance ?? '',
    };
  } catch (err) {
    return {
      change_type: '',
      summary: `[AI 解读失败，原因: ${err}]`,
      importance: '',
    };
  }
}