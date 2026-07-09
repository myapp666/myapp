// 临时测试脚本：向 2070557743@qq.com 发送一封测试邮件
// 用法：node scripts/test-mail.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import nodemailer from 'nodemailer';

// 加载 .env.local（按行解析，不依赖额外包）
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 465);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM || user;

if (!host || !user || !pass) {
  console.error('[test-mail] SMTP 配置缺失：', { host, user, pass: pass ? '***' : undefined });
  process.exit(1);
}

const to = '2070557743@qq.com';
const subject = '[测试] 竞争情报监控 — 邮件发送连通性测试';
const text = [
  '您好，',
  '',
  '这是一封来自 竞争情报监控系统 的测试邮件。',
  '',
  `发送时间：${new Date().toISOString()}`,
  `SMTP 服务器：${host}:${port}`,
  `发件账号：${user}`,
  `收件邮箱：${to}`,
  '',
  '如果您收到此邮件，说明 SMTP 通道已正常工作。',
  '',
  '——',
  '竞争情报监控系统',
].join('\n');

console.log(`[test-mail] 正在通过 ${host}:${port} 发送 → ${to} ...`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  const info = await transporter.sendMail({ from, to, subject, text });
  console.log('[test-mail] 发送成功 ✅');
  console.log('  messageId :', info.messageId);
  console.log('  accepted  :', info.accepted);
  console.log('  rejected  :', info.rejected);
  console.log('  response  :', info.response);
} catch (err) {
  console.error('[test-mail] 发送失败 ❌');
  console.error(err);
  process.exit(1);
}
