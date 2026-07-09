import { prisma } from './db';
import { fetchHtml, diffHtml } from './scraper';
import { analyzeChange, type ChangeAnalysis } from './llm';
import { sendChangeNotification } from './mailer';
import { ensureMarkdown, htmlToMarkdown } from './markdown';

// 取该 URL 组（全部监控此 URL 的 competitor）最近一次抓到的 HTML 作为统一 oldHtml。
// 目的：N 用户同 URL → 永远共用同一份 diff 基线 → AI 调用次数 = unique_url 数（确定的 1:1）。
async function getSharedOldHtml(competitorIds: number[]): Promise<string> {
  if (competitorIds.length === 0) return '';
  const latest = await prisma.snapshot.findFirst({
    where: { competitorId: { in: competitorIds } },
    orderBy: { crawledAt: 'desc' },
    select: { htmlContent: true },
  });
  return latest?.htmlContent ?? '';
}

// 把已算好的 diff/AI 结果落到单个 competitor：写 snapshot + 发邮件
async function applyAnalysis(
  competitorId: number,
  websiteUrl: string,
  newHtml: string,
  analysis: ChangeAnalysis,
): Promise<void> {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) return;

  const snapshot = await prisma.snapshot.create({
    data: {
      competitorId,
      userId: competitor.userId,
      htmlContent: newHtml,
      changeType: analysis.change_type,
      summary: analysis.summary,
      importance: analysis.importance,
    },
  });
  console.info(
    `已保存变更 competitor_id=${competitorId} url=${websiteUrl} change_type=${analysis.change_type}`,
  );

  // 邮件通知（仅在用户开启时）
  try {
    const user = await prisma.user.findUnique({
      where: { id: competitor.userId },
      select: { email: true, username: true, emailNotifyEnabled: true },
    });
    if (user?.emailNotifyEnabled) {
      sendChangeNotification({
        toEmail: user.email,
        toUsername: user.username,
        competitorName: competitor.name,
        competitorUrl: websiteUrl,
        changeType: analysis.change_type,
        summary: analysis.summary,
        importance: analysis.importance,
        crawledAt: snapshot.crawledAt.toISOString(),
      }).catch((err) => console.error('邮件发送失败', err));
    }
  } catch (err) {
    console.error('查询用户/发送邮件出错', err);
  }
}

// 一个 URL 一组：fetch 1 次 + diff 1 次 + AI 1 次 → 落到每行 competitor
async function collectByUrl(websiteUrl: string, competitorIds: number[]): Promise<void> {
  // 1. 统一基线：组内所有 competitor 共用同一份 oldHtml
  const oldHtml = await getSharedOldHtml(competitorIds);

  // 2. 抓 1 次
  let newHtml: string;
  try {
    newHtml = await fetchHtml(websiteUrl);
  } catch (err) {
    console.error(`采集失败 url=${websiteUrl} competitors=${competitorIds.join(',')}`, err);
    return;
  }

  // 3. 转 markdown 后 diff 1 次
  // 喂给 LLM 的是 markdown 而不是 HTML：体积小、语义清、LLM 更容易识别真实变化
  // 老数据兼容：DB 里如果存的是旧版 HTML（looksLikeHtml 命中），自动转一次
  const oldMarkdown = ensureMarkdown(oldHtml);
  const newMarkdown = htmlToMarkdown(newHtml);
  const diff = diffHtml(oldMarkdown, newMarkdown);
  if (!diff) {
    console.debug(`无变化 url=${websiteUrl}`);
    return;
  }

  // 4. AI 1 次（确定：N 用户同 URL 永远只调 1 次）
  const analysis = await analyzeChange(websiteUrl, diff);

  // 5. 落到每个 competitor：snapshot + 邮件（用户隔离，仍并行）
  await Promise.allSettled(
    competitorIds.map((id) => applyAnalysis(id, websiteUrl, newHtml, analysis)),
  );
}

export async function collectAll(): Promise<void> {
  const competitors = await prisma.competitor.findMany({
    select: { id: true, websiteUrl: true },
  });
  if (competitors.length === 0) return;

  // 按 websiteUrl 分组（兼容尾部斜杠：'https://x' 和 'https://x/' 视为同一组）
  const byUrl = new Map<string, number[]>();
  for (const c of competitors) {
    const normalized = c.websiteUrl.replace(/\/+$/, '');
    const list = byUrl.get(normalized);
    if (list) list.push(c.id);
    else byUrl.set(normalized, [c.id]);
  }

  console.info(
    `采集计划 competitors=${competitors.length} unique_urls=${byUrl.size} ` +
      `（fetchHtml=${byUrl.size} 次，AI=${byUrl.size} 次，确定 1:1）`,
  );

  // 不同 URL 之间并行
  await Promise.allSettled(
    Array.from(byUrl.entries()).map(([url, ids]) => collectByUrl(url, ids)),
  );
}