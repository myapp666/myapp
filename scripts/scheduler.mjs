// 本地定时采集调度器
// 用途：dev 环境替代 Vercel cron，每 MONITOR_INTERVAL 分钟调一次 /api/cron/collect
// 启动：npm run scheduler（需先 npm run dev，且 dev server 在 API_BASE 上监听）
// 停止：Ctrl+C

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 极简 .env.local 解析（只读 KEY="VALUE" 或 KEY=VALUE）
function loadEnv(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const raw of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };

const API_BASE = env.API_BASE || 'http://localhost:3000';
const INTERVAL_MIN = Number(env.MONITOR_INTERVAL ?? 5);
const INTERVAL_MS = INTERVAL_MIN * 60 * 1000;
const CRON_SECRET = env.CRON_SECRET;
const URL = `${API_BASE}/api/cron/collect`;

if (!CRON_SECRET) {
  console.error('[scheduler] CRON_SECRET 未配置（检查 .env.local）');
  process.exit(1);
}

let running = false;

async function tick() {
  if (running) {
    console.warn('[scheduler] 上一次还在跑，跳过本次触发');
    return;
  }
  running = true;
  const t0 = Date.now();
  const stamp = new Date().toISOString();
  console.log(`[scheduler] ${stamp} GET ${URL}`);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000); // 单次 5 分钟超时
    const res = await fetch(URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    console.log(`[scheduler] ${res.status} ${text} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.error(`[scheduler] 失败: ${err}`);
  } finally {
    running = false;
  }
}

console.log(`[scheduler] 启动 → ${URL}`);
console.log(`[scheduler] 间隔 ${INTERVAL_MIN} 分钟 (${INTERVAL_MS}ms)`);
console.log(`[scheduler] 立即触发一次，然后进入定时循环`);

// 启动后立即跑一次（不必等 5 分钟才看到效果）
await tick();

// 之后每 INTERVAL_MS 跑一次
setInterval(tick, INTERVAL_MS);

// 优雅退出
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[scheduler] 收到 ${sig}，退出`);
    process.exit(0);
  });
}