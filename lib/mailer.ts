import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn('[mailer] SMTP 配置缺失（需要 SMTP_HOST / SMTP_USER / SMTP_PASS），跳过邮件发送');
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export interface ChangeEmailPayload {
  toEmail: string;
  toUsername: string;
  competitorName: string;
  competitorUrl: string;
  changeType: string;
  summary: string;
  importance: string;
  crawledAt: string;
}

function buildSubject(p: ChangeEmailPayload): string {
  const tag = p.importance ? `（${p.importance}）` : '';
  return `[竞争情报] ${p.competitorName} 有新变化${tag}`;
}

function buildBody(p: ChangeEmailPayload): string {
  return [
    `${p.toUsername} 您好，`,
    '',
    `您监控的竞对《${p.competitorName}》（${p.competitorUrl}）`,
    `于 ${p.crawledAt} 发生了新变化。`,
    '',
    `变更类型：${p.changeType || '未分类'}`,
    `重要度：${p.importance || '未评估'}`,
    '',
    'AI 解读：',
    p.summary,
    '',
    '——',
    '竞争情报监控系统',
  ].join('\n');
}

export async function sendChangeNotification(payload: ChangeEmailPayload): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const from = process.env.MAIL_FROM || `"竞争情报监控" <${process.env.SMTP_USER}>`;
  const subject = buildSubject(payload);
  const text = buildBody(payload);
  try {
    const info = await t.sendMail({ from, to: payload.toEmail, subject, text });
    console.info(`[mailer] 已发送 → ${payload.toEmail} (messageId=${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`[mailer] 发送失败 → ${payload.toEmail}: ${err}`);
    return false;
  }
}