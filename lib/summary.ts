// 摘要分段解析：识别 lib/llm.ts 生成的【变更】【意图】【行动】【理由】四类标签。
// 共享给 API route（/api/changes）和 client dashboard。

export type SummarySectionKey = 'change' | 'intent' | 'action' | 'reason' | 'plain';

export interface SummarySection {
  key: SummarySectionKey;
  text: string;
}

const KEY_MAP: Record<string, SummarySectionKey> = {
  变更: 'change',
  意图: 'intent',
  行动: 'action',
  理由: 'reason',
};

const SECTION_PATTERN = /【(变更|意图|行动|理由)】/g;

// 把 LLM 输出的整段 summary 切成有序的段。
// 段头未识别的内容归到 'plain' 段，保持阅读顺序。
export function parseSummarySections(summary: string): SummarySection[] {
  if (!summary) return [];
  const out: SummarySection[] = [];
  let lastIndex = 0;
  SECTION_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_PATTERN.exec(summary)) !== null) {
    if (m.index > lastIndex) {
      const leading = summary.slice(lastIndex, m.index).trim();
      if (leading) out.push({ key: 'plain', text: leading });
    }
    const key = KEY_MAP[m[1]] ?? 'plain';
    lastIndex = SECTION_PATTERN.lastIndex;
    const rest = summary.slice(lastIndex);
    const nextMatch = rest.match(/【(变更|意图|行动|理由)】/);
    const segEnd = nextMatch ? nextMatch.index ?? rest.length : rest.length;
    out.push({ key, text: rest.slice(0, segEnd).trim() });
    lastIndex += segEnd;
    SECTION_PATTERN.lastIndex = lastIndex;
  }
  if (lastIndex < summary.length) {
    const trailing = summary.slice(lastIndex).trim();
    if (trailing) out.push({ key: 'plain', text: trailing });
  }
  return out;
}

// 取【变更】段文本；若没有则退到整段 summary 的纯文本截断
export function extractChangeContent(summary: string | null | undefined, maxLen = 600): string {
  if (!summary) return '';
  const sections = parseSummarySections(summary);
  const change = sections.find((s) => s.key === 'change');
  const text = change?.text ?? summary;
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

// 取【意图】+【行动】+【理由】三段拼接；空段自动跳过
export function extractIntentAnalysis(summary: string | null | undefined): string {
  if (!summary) return '';
  const sections = parseSummarySections(summary);
  const parts: string[] = [];
  for (const sec of sections) {
    if (sec.key === 'intent' || sec.key === 'action' || sec.key === 'reason') {
      if (sec.text) parts.push(`【${labelOf(sec.key)}】${sec.text}`);
    }
  }
  return parts.join('\n');
}

function labelOf(key: SummarySectionKey): string {
  switch (key) {
    case 'intent':
      return '意图';
    case 'action':
      return '行动';
    case 'reason':
      return '理由';
    default:
      return '';
  }
}