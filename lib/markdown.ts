import TurndownService from 'turndown';

// 单例：turndown 内部构建 Cheerio DOM，开销不低，模块级共享
const turndown = new TurndownService({
  headingStyle: 'atx',        // # h1, ## h2
  codeBlockStyle: 'fenced',   // ```code```
  bulletListMarker: '-',      // 跟项目里 prompt 的"禁止连字符列表"对不上但这是输入侧，无影响
  emDelimiter: '*',
});

// 去掉噪声：脚本/样式/嵌入/不可见内容不进 LLM
// turndown.remove 在 v7 里 type 限定 keyof HTMLElementTagNameMap，但 svg/aria-hidden 不在；
// 用断言 + 自定义 filter 组合处理
turndown.remove([
  'script',
  'style',
  'noscript',
  'iframe',
  'svg' as 'iframe',
  'meta',
  'link',
  'header',     // 顶部导航通常变动频繁但语义价值低
  'footer',     // 同上
]);
// 不可见元素用 filter 函数：aria-hidden 或 display:none
turndown.remove((node) => {
  if (node.nodeType !== 1) return false;
  const el = node as HTMLElement;
  if (el.getAttribute?.('aria-hidden') === 'true') return true;
  const style = el.getAttribute?.('style') ?? '';
  if (/display\s*:\s*none/i.test(style)) return true;
  return false;
});

// 入口：把 HTML 字符串转成 markdown；失败时退回原文（避免阻断 collect）
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';
  try {
    const md = turndown.turndown(html);
    // 折叠连续空行（>2 个 \n 合并成 2 个）
    return md.replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return html;
  }
}

// 判定一段文本更像 HTML 还是 markdown
// 启发式：包含块级 HTML 标签（<html/<body/<div/<p/<a/<h1 等）视作 HTML
export function looksLikeHtml(content: string): boolean {
  if (!content) return false;
  // 找前 500 字符里有无典型 HTML 标签
  const head = content.slice(0, 500);
  return /<(html|body|div|p|a|h[1-6]|span|ul|ol|li|table|tr|td|section|article|nav|main)\b/i.test(head);
}

// 老数据兼容：如果 DB 里存的是 HTML（旧版本遗留），转一次成 markdown；
// 如果已经是 markdown 文本，直接返回。
export function ensureMarkdown(content: string | null | undefined): string {
  if (!content) return '';
  if (looksLikeHtml(content)) return htmlToMarkdown(content);
  return content;
}