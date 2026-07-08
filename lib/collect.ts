import { prisma } from './db';
import { fetchHtml, diffHtml } from './scraper';
import { analyzeChange } from './llm';
import { sendChangeNotification } from './mailer';

async function collectCompetitor(competitorId: number): Promise<void> {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) return;

  let newHtml: string;
  try {
    newHtml = await fetchHtml(competitor.websiteUrl);
  } catch (err) {
    console.error(`采集失败 competitor_id=${competitorId} url=${competitor.websiteUrl}`, err);
    return;
  }

  const latest = await prisma.snapshot.findFirst({
    where: { competitorId },
    orderBy: { crawledAt: 'desc' },
    select: { htmlContent: true },
  });

  const oldHtml = latest?.htmlContent ?? '';
  const diff = diffHtml(oldHtml, newHtml);
  if (!diff) {
    console.debug(`无变化 competitor_id=${competitorId}`);
    return;
  }

  const analysis = await analyzeChange(competitor.websiteUrl, diff);
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
  console.info(`已保存变更 competitor_id=${competitorId} change_type=${analysis.change_type}`);

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
        competitorUrl: competitor.websiteUrl,
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

export async function collectAll(): Promise<void> {
  const competitors = await prisma.competitor.findMany({ select: { id: true } });
  await Promise.allSettled(competitors.map((c) => collectCompetitor(c.id)));
}
