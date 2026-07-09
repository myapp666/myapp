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
  // 注意：Vercel Serverless 对裸 SMTP 长事务不友好（TLS 握手常被内部 LB 中断）。
  // 这里显式设短超时 + TLSv1.2，失败由 sendChangeNotification 的重试兜底。
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000, // TCP 连接 10s
    greetingTimeout: 10_000,   // SMTP 欢迎语 10s
    socketTimeout: 15_000,     // 任意包间隔 15s 无活动则断
    tls: {
      minVersion: 'TLSv1.2',
      // 163 证书链偶尔在云 IP 段握手失败，先不 rejectUnauthorized=false
      // 若确认是证书问题再开 —— 开了一定要在 .env 里挂开关
    },
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
  const mailOptions = { from, to: payload.toEmail, subject, text };

  // TLS 握手被 Vercel LB / 163 反垃圾 RST 是典型 transient failure。
  // 至多重试 1 次（总计 2 次尝试），避免 cron 里堆积重试占满函数时长。
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await t.sendMail(mailOptions);
      console.info(
        `[mailer] 已发送 → ${payload.toEmail} (attempt=${attempt}/${MAX_ATTEMPTS} messageId=${info.messageId})`,
      );
      return true;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      const isLast = attempt === MAX_ATTEMPTS;
      // 打印足够上下文便于排查（host/port/errno/code 都在 Vercel 日志里能直接看到）
      console.error(
        `[mailer] 发送失败 → ${payload.toEmail} (attempt=${attempt}/${MAX_ATTEMPTS} ` +
          `host=${process.env.SMTP_HOST}:${process.env.SMTP_PORT} ` +
          `code=${e?.code ?? '-'} errno=${e?.errno ?? '-'}): ${e?.message ?? e}`,
      );
      if (isLast) return false;
      // 退避 1.5s 后重试；用 setTimeout 包成 Promise
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}