import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN;
const baseURL = process.env.ANTHROPIC_BASE_URL;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const client = new Anthropic({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

// ---------- 枚举与类型 ----------
// 严格枚举：model 必须输出这些值之一（'' 仅作"AI 解读失败/未识别"占位）
export type ChangeType =
  | '价格变动'
  | '产品更新'
  | '促销活动'
  | '页面重构'
  | '内容更新'
  | '其他';

export type Importance = '低' | '中' | '高';

const CHANGE_TYPES: readonly ChangeType[] = [
  '价格变动',
  '产品更新',
  '促销活动',
  '页面重构',
  '内容更新',
  '其他',
] as const;

const IMPORTANCES: readonly Importance[] = ['低', '中', '高'] as const;

const SUMMARY_MARKERS = ['【变更】', '【意图】', '【行动】', '【理由】'] as const;
// importance → summary 必需段映射：低=1 段（仅【变更】）；中/高=4 段
const REQUIRED_MARKERS_BY_IMPORTANCE: Record<Importance, readonly string[]> = {
  低: ['【变更】'],
  中: SUMMARY_MARKERS,
  高: SUMMARY_MARKERS,
};

// 公开接口：enum 联合 + '' 兜底（'' = 解读失败/未识别，dashboard 用作"未分类"过滤）
export interface ChangeAnalysis {
  change_type: ChangeType | '';
  summary: string;
  importance: Importance | '';
}

// ---------- Prompt ----------
const PROMPT_TMPL = `你是竞争情报分析师，专责解读竞品网站变更。你的输出会被程序直接 JSON.parse 解析，必须严格遵守格式。

【硬性规则】
- 只输出单个合法 JSON 对象
- 禁止所有 markdown 符号：反引号代码块、井号标题、连字符列表、星号强调、大于号引用、方括号链接
- 禁止前后置文字：禁止"以下是""输出：""答案是"等引导语；禁止注释、空行、解释
- summary 字段值内禁止出现花括号 { }，否则会破坏 JSON 结构
- 任何违规都会让下游 JSON.parse 崩溃，必须绝对避免

【任务】
阅读下面的 unified diff，输出结构化分析。低 importance 变更（页面样式/内容更新等）只需简短摘要；中/高 importance 需要完整 4 段分析。

【输入】
URL: {url}
当前时间: {current_time}
变更摘要（unified diff，最多 2000 字符）:
{diff}

【输出 schema - 必须完全匹配】
{
  "change_type": "价格变动|产品更新|促销活动|页面重构|内容更新|其他",
  "summary": "见下方【summary 结构】规则",
  "importance": "低|中|高"
}

【change_type → importance 边界规则】
按 change_type 给定 baseline importance（不要默认"中"，按事实更精确）：
- 页面重构（纯样式/布局/视觉/导航样式，无新功能）→ importance="低"
  例：换主图、调字体、改色板、布局微调
- 内容更新（博客/案例/帮助文档/SEO 文案/产品页文案微调）→ importance="低"
- 价格变动 → importance="中"或"高"（按金额/影响面）
- 产品更新 → importance="中"或"高"（按功能权重）
- 促销活动 → importance="中"（常态）/"高"（大促节点如双11、黑五、618、年终）
- 上述 baseline 可上调：当事实非常重大时
  - 页面重构若涉及大改版（首页全换、跨页面统一切换、品牌升级）→ 可升至"中"
  - 内容更新若涉及核心产品页文案剧变、SEO 关键词猛增 → 可升至"中"
- 边界规则：
  - 节日降价（如双11、黑五）→ change_type="促销活动"，不要选"价格变动"
  - 导航/布局改版无功能变化 → "页面重构"；有功能变化 → "产品更新"

【summary 结构 - 按 importance 分级输出】
- importance="低"：只输出【变更】一段（≤ 30 字），不需要【意图】【行动】【理由】
  例：{"change_type":"页面重构","summary":"【变更】首页主图换成视频背景。","importance":"低"}
- importance="中"：必须输出完整 4 段
- importance="高"：必须输出完整 4 段
  4 段规范：
  - 【变更】≤ 30 字，数字/事实优先，只挑最重要那一点
  - 【意图】30-80 字，分析竞品为什么这么做；结合当前时间判断时效（如电商节庆、营销旺季需重点关注）
  - 【行动】30-80 字，必须具体可执行：含主语+动词+截止时间
    ✓ "本周三前评审我方定价，准备对标方案"
    ✗ "应该关注市场反应""需要尽快跟进"
  - 【理由】30-80 字，必须含可量化依据（数字/百分比/时间窗）或紧迫性说明
    ✓ "预计流失 5-10% 付费用户，月损 30-50 万营收"
    ✗ "影响很大""需要重视"
- 不要为"补齐 4 段"而硬凑——若 action 实在想不出，可写"暂无需动作"并用【理由】说明
- 若 model 选了 importance="低" 但写了 4 段，程序会接受（不要为了"看起来完整"主动升级 importance）

【正例 - 必须照此格式输出】
价格变动（高/4 段）：{"change_type":"价格变动","summary":"【变更】套餐降价 20%。【意图】通过价格战抢流失用户，提升续费率和市占。【行动】本周内评审我方定价策略，准备对应降价或对标低价套餐。【理由】不及时响应预计流失 5-10% 付费用户，月损 30-50 万营收","importance":"高"}
产品更新（中/4 段）：{"change_type":"产品更新","summary":"【变更】新增 AI 智能摘要功能。【意图】对标 Notion AI，提升付费转化与差异化。【行动】评估我方是否接入类似 LLM 摘要能力，2 周内给方案。【理由】错过 AI 趋势会被定位为传统笔记，中长尾流失 5-10% 付费","importance":"中"}
页面重构（低/1 段）：{"change_type":"页面重构","summary":"【变更】首页主图换成视频背景。","importance":"低"}
内容更新（低/1 段）：{"change_type":"内容更新","summary":"【变更】新增 2 篇产品案例博客。","importance":"低"}

【反例 - 绝对不要】
错误1：用三个反引号加 json 把 JSON 整段包起来
错误2：前面写"以下是分析结果"再跟 JSON
错误3：用井号当标题加连字符列表组织内容
错误4：importance="中"或"高"时只写了【变更】【意图】却漏掉【行动】【理由】（4 段缺一不可）
错误5：【变更】段超过 30 字或罗列了多个细节，没有聚焦"最重要的一点"
错误6：importance 用了"非常高""极高""重要"等不在 3 选 1 内的词汇
错误7：change_type 用了"营销活动""品牌升级""战略调整"等不在 6 选 1 内的词汇
错误8：importance="低"时硬凑 4 段（用空话填充【意图】/【行动】/【理由】），会浪费 token 并触发告警疲劳
错误9：importance="低"但实际涉及价格/功能变化，应该升"中"或"高"`;

// ---------- 防御性 JSON 解析 ----------
function extractJson(text: string): unknown {
  let cleaned = text.trim();
  // 去掉首尾的 ```json / ``` 围栏（不区分大小写）
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  // 在剩余文本中找最外层 {...}，容忍前后置文字
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('未在模型输出中找到 JSON 对象');
  return JSON.parse(match[0]);
}

// ---------- 类型规范化：把 model 输出强制成 ChangeAnalysis ----------
// 关键原则：
//   - 解析失败（catch）/ 字段缺失 → 落到 ''（dashboard 的"未分类"桶），summary 写 [AI 解读失败, 原因: ...]
//   - 解析成功但值非法（如 change_type="营销活动"）→ 同样落到 ''（避免污染"其他"桶），warning 写进 summary
//   - 解析成功且值合法 → 原样保留
//   - summary 必需段检查按 importance 动态决定：低=1 段（【变更】）；中/高=4 段
//   - 一切 warning 同时 console.warn（开发可观察）+ 写进 summary 尾部 [validation: ...]（用户可观察）
//   - model 选了"低"但写了 4 段：程序接受（prompt 已说明不要为"看起来完整"主动升级 importance）
//   - model 选了"中/高"但只写了 1 段：触发 warning，告知用户"结构不完整"
interface RawAnalysis {
  change_type?: unknown;
  summary?: unknown;
  importance?: unknown;
}

interface NormalizeResult {
  value: ChangeAnalysis;
  warnings: string[];
}

function normalizeAnalysis(raw: RawAnalysis, sourceErr?: unknown): NormalizeResult {
  const warnings: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // change_type
  let change_type: ChangeType | '' = '';
  if (typeof raw.change_type === 'string') {
    if ((CHANGE_TYPES as readonly string[]).includes(raw.change_type)) {
      change_type = raw.change_type as ChangeType;
    } else {
      warnings.push(`change_type="${raw.change_type.slice(0, 30)}" 不在 6 选 1`);
    }
  } else {
    warnings.push(raw.change_type === undefined ? 'change_type 字段缺失' : 'change_type 不是字符串');
  }

  // importance
  let importance: Importance | '' = '';
  if (typeof raw.importance === 'string') {
    if ((IMPORTANCES as readonly string[]).includes(raw.importance)) {
      importance = raw.importance as Importance;
    } else {
      warnings.push(`importance="${raw.importance.slice(0, 10)}" 不在 3 选 1`);
    }
  } else {
    warnings.push(raw.importance === undefined ? 'importance 字段缺失' : 'importance 不是字符串');
  }

  // summary
  let summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  if (summary.length === 0) {
    summary = sourceErr
      ? `[AI 解读失败, 原因: ${sourceErr}]`
      : '[AI 解读失败, 原因: summary 为空]';
  } else {
    // 按 importance 决定必需段：低=1 段（【变更】），中/高=4 段；importance 未知时不检查（避免级联误报）
    const required =
      importance === '低' || importance === '中' || importance === '高'
        ? REQUIRED_MARKERS_BY_IMPORTANCE[importance]
        : undefined;
    if (required) {
      const missing = required.filter((m) => !summary.includes(m));
      if (missing.length > 0) {
        warnings.push(
          importance === '低'
            ? `summary 缺【变更】`
            : `importance=${importance} 但 summary 缺标记: ${missing.join('/')}`,
        );
      }
    }
  }

  // 把 validation 标记写进 summary 尾部（避免重复：已含 [validation: 则跳过）
  if (warnings.length > 0 && !summary.includes('[validation:')) {
    summary = `${summary} [validation: ${today} ${warnings.join('; ')}]`.trim();
  }

  return { value: { change_type, summary, importance }, warnings };
}

// ---------- 主函数 ----------
export async function analyzeChange(url: string, diff: string): Promise<ChangeAnalysis> {
  const diffSummary = diff.slice(0, 2000) || '（无差异）';
  const currentTime = formatNowCST();
  const prompt = PROMPT_TMPL
    .replace('{url}', url)
    .replace('{current_time}', currentTime)
    .replace('{diff}', diffSummary);

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (resp.content[0] as { type: string; text: string }).text.trim();
    const parsed = extractJson(text) as RawAnalysis;
    const { value, warnings } = normalizeAnalysis(parsed);
    logValidation(url, warnings);
    return value;
  } catch (err) {
    const { value, warnings } = normalizeAnalysis({}, err);
    logValidation(url, warnings, err);
    return value;
  }
}

// ---------- 工具：当前时间（CST，YYYY-MM-DD HH:MM） + 校验日志 ----------
function formatNowCST(): string {
  const now = new Date();
  // 用 Intl 转 CST，输出形如 "2026-07-09 14:23"
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function logValidation(url: string, warnings: string[], sourceErr?: unknown): void {
  if (warnings.length === 0 && !sourceErr) return;
  // 单行结构化日志，便于在 Vercel/Cron 日志里 grep
  if (sourceErr) {
    console.warn(
      `[llm] analyzeChange 异常 url=${url} err=${sourceErr instanceof Error ? sourceErr.message : String(sourceErr)}`,
    );
    return;
  }
  console.warn(
    `[llm] analyzeChange 校验告警 url=${url} count=${warnings.length} details=${JSON.stringify(warnings)}`,
  );
}
