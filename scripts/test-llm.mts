// scripts/test-llm.mts
// 用法：node --experimental-strip-types scripts/test-llm.mts
// 覆盖 lib/llm.ts 的 analyzeChange + normalizeAnalysis 12+ 分支；无需真实 API Key。
//
// 策略：
// - 本地 mock HTTP server 拦截 Anthropic SDK 调用
// - 通过 nextBehavior 切换 mock 输出（合法 JSON / 缺字段 / 非法值 / 异常状态码）
// - 捕获每次请求的 prompt（用于断言 current_time 注入、prompt 模板结构）
// - 捕获 console.warn 输出（用于断言可观察性）

import http from 'node:http';
import type { AddressInfo } from 'node:net';

// ---------- 启动 mock HTTP server ----------

type MockBehavior =
  | { mode: 'ok_json'; payload: object }
  | { mode: 'ok_text'; text: string }
  | { mode: 'throw_status'; status: number; body: string };

let nextBehavior: MockBehavior = { mode: 'ok_json', payload: {} };
let capturedPrompt = ''; // 每次请求都会被覆盖

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      capturedPrompt = parsed.messages?.[0]?.content ?? '';
    } catch {
      capturedPrompt = '';
    }
    const beh = nextBehavior;
    if (beh.mode === 'throw_status') {
      res.statusCode = beh.status;
      res.setHeader('content-type', 'application/json');
      res.end(beh.body);
      return;
    }
    const text = beh.mode === 'ok_json' ? JSON.stringify(beh.payload) : beh.text;
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        id: 'msg_mock',
        type: 'message',
        role: 'assistant',
        model: 'mock',
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    );
  });
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

// ---------- 在 import lib/llm.ts 之前设置 env ----------

process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}/v1`;
process.env.AI_API_KEY = 'mock-key-for-test';

// 捕获 console.warn（用于断言可观察性日志）
const warnMessages: string[] = [];
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  warnMessages.push(args.map((a) => String(a)).join(' '));
  origWarn(...args);
};

// dynamic import：env 已就位
const { analyzeChange } = await import('../lib/llm.ts');

// ---------- 测试框架 ----------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}

async function runCase(name: string, fn: () => void | Promise<void>) {
  console.log(`\n[${name}]`);
  // 每个 case 前清空捕获（保证 case 间隔离）
  capturedPrompt = '';
  warnMessages.length = 0;
  try {
    await fn();
  } catch (err) {
    failed++;
    failures.push(`${name}: threw ${err instanceof Error ? err.message : String(err)}`);
    console.log(`  ✗ threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------- T1：完全合法 JSON（低/1 段）→ 字段原样 ----------

await runCase('T1 合法 JSON（低/1 段）', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '页面重构', summary: '【变更】首页主图换成视频背景。', importance: '低' },
  };
  const r = await analyzeChange('https://example.com', '+ <div>video bg</div>');
  assert(r.change_type === '页面重构', `change_type === "页面重构"，实际：${r.change_type}`);
  assert(r.importance === '低', `importance === "低"，实际：${r.importance}`);
  assert(r.summary === '【变更】首页主图换成视频背景。', `summary 原样保留，实际：${r.summary}`);
  assert(warnMessages.length === 0, `无 console.warn，实际：${warnMessages.length} 条`);
});

// ---------- T2：完全合法 JSON（中/4 段）→ 字段原样 ----------

await runCase('T2 合法 JSON（中/4 段）', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: {
      change_type: '价格变动',
      summary: '【变更】套餐降价 20%。【意图】抢流失用户。【行动】本周评审定价。【理由】流失 5% 付费。',
      importance: '中',
    },
  };
  const r = await analyzeChange('https://example.com', '+ price 99 → 79');
  assert(r.change_type === '价格变动', `change_type === "价格变动"`);
  assert(r.importance === '中', `importance === "中"`);
  assert(r.summary.includes('【行动】') && r.summary.includes('【理由】'), `summary 含 4 段`);
  assert(warnMessages.length === 0, `无 console.warn`);
});

// ---------- T3：缺 change_type → '' + validation ----------

await runCase('T3 缺 change_type', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { summary: '【变更】首页改版。', importance: '低' },
  };
  const r = await analyzeChange('https://example.com', '+ <p>change</p>');
  assert(r.change_type === '', `change_type === ""，实际：${r.change_type}`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
  assert(warnMessages.length === 1, `恰好 1 条 console.warn，实际：${warnMessages.length}`);
  assert(warnMessages[0].includes('change_type'), `warn 内容含 change_type`);
});

// ---------- T4：缺 importance → '' + validation ----------

await runCase('T4 缺 importance', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '页面重构', summary: '【变更】换主图。' },
  };
  const r = await analyzeChange('https://example.com', '+ <img src=video.mp4>');
  assert(r.importance === '', `importance === ""，实际：${r.importance}`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
  assert(warnMessages.length === 1, `恰好 1 条 console.warn`);
});

// ---------- T5：缺 summary → '[AI 解读失败, 原因: ...]' ----------

await runCase('T5 缺 summary', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '页面重构', importance: '低' },
  };
  const r = await analyzeChange('https://example.com', '+ <p>x</p>');
  assert(r.summary.startsWith('[AI 解读失败'), `summary 以 [AI 解读失败 开头，实际：${r.summary.slice(0, 30)}`);
  assert(r.summary.includes('summary 为空'), `说明原因"summary 为空"`);
});

// ---------- T6：非法 change_type → '' + validation ----------

await runCase('T6 非法 change_type', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '营销活动', summary: '【变更】双 11 营销。', importance: '低' },
  };
  const r = await analyzeChange('https://example.com', '+ <p>11.11 sale</p>');
  assert(r.change_type === '', `change_type 落到 ""，实际：${r.change_type}`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
  assert(warnMessages[0]?.includes('不在 6 选 1'), `warn 说明非法值`);
});

// ---------- T7：非法 importance → '' + validation ----------

await runCase('T7 非法 importance', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '价格变动', summary: '【变更】降价 20%。', importance: '极高' },
  };
  const r = await analyzeChange('https://example.com', '+ price -20%');
  assert(r.importance === '', `importance 落到 ""，实际：${r.importance}`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
});

// ---------- T8：importance="中" 但只写了 1 段 → 触发 validation ----------

await runCase('T8 中/高 importance 但 summary 缺段', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '价格变动', summary: '【变更】降价 20%。', importance: '中' },
  };
  const r = await analyzeChange('https://example.com', '+ price -20%');
  assert(r.importance === '中', `importance === "中"`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
  assert(r.summary.includes('缺标记'), `warn 说明缺标记`);
});

// ---------- T9：importance="低" 但写了 4 段 → 接受（不警告）----------

await runCase('T9 低 importance 但 4 段完整', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: {
      change_type: '内容更新',
      summary: '【变更】新增 3 篇博客。【意图】SEO 引流。【行动】观察流量。【理由】期望 +5% 搜索曝光。',
      importance: '低',
    },
  };
  const r = await analyzeChange('https://example.com', '+ 3 new blog posts');
  assert(r.importance === '低', `importance === "低"`);
  assert(warnMessages.length === 0, `无 console.warn（低 + 4 段也接受）`);
});

// ---------- T10：mock 500 错误 → 兜底 + 异常日志 ----------

await runCase('T10 mock 500 错误', async () => {
  nextBehavior = { mode: 'throw_status', status: 500, body: '{"error":"internal"}' };
  const r = await analyzeChange('https://example.com', '+ <p>x</p>');
  assert(r.change_type === '', `change_type === ""`);
  assert(r.importance === '', `importance === ""`);
  assert(r.summary.startsWith('[AI 解读失败'), `summary 以 [AI 解读失败 开头`);
  assert(warnMessages.length === 1, `恰好 1 条 console.warn（异常）`);
  assert(warnMessages[0].includes('analyzeChange 异常'), `warn 标记为异常`);
});

// ---------- T11：current_time 注入 prompt ----------

await runCase('T11 current_time 注入', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { change_type: '页面重构', summary: '【变更】换主图。', importance: '低' },
  };
  await analyzeChange('https://example.com', '+ x');
  // 匹配 "YYYY-MM-DD HH:MM" 格式（CST）
  assert(/当前时间: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(capturedPrompt), `prompt 含 "当前时间: YYYY-MM-DD HH:MM"，实际：${capturedPrompt.match(/当前时间: .{16}/)?.[0] ?? 'NOT FOUND'}`);
});

// ---------- T12：边界 case：低 importance + 4 段全 + change_type 非法 混合 → 多 warning 堆叠 ----------

await runCase('T12 多 warning 堆叠', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: {
      change_type: '战略调整', // 非法
      summary: '【变更】调整方向。', // 缺意图行动理由——但因 importance=低，校验只看【变更】
      importance: '低',
    },
  };
  const r = await analyzeChange('https://example.com', '+ x');
  // 期望：change_type 非法（warning），importance=低 时 summary 缺 意图/行动/理由 不算 warning
  assert(r.change_type === '', `change_type 非法 → ""`);
  assert(r.importance === '低', `importance === "低"`);
  // 应该有 1 条 warning（仅 change_type 非法）
  const ctWarns = warnMessages.filter((m) => m.includes('change_type'));
  assert(ctWarns.length === 1, `恰好 1 条 change_type 相关 warn，实际：${ctWarns.length}`);
});

// ---------- T13：low + 缺【变更】 → warning ----------

await runCase('T13 低 importance 但缺【变更】', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: {
      change_type: '页面重构',
      summary: '改了个样式', // 缺【变更】标记
      importance: '低',
    },
  };
  const r = await analyzeChange('https://example.com', '+ x');
  assert(r.importance === '低', `importance === "低"`);
  assert(r.summary.includes('[validation:'), `summary 含 [validation:] 标记`);
  assert(r.summary.includes('summary 缺【变更】'), `warn 说明缺【变更】`);
});

// ---------- 汇总 ----------

console.log(`\n========== 汇总 ==========`);
console.log(`PASS: ${passed}`);
console.log(`FAIL: ${failed}`);
if (failed > 0) {
  console.log(`\n失败项：`);
  for (const f of failures) console.log(`  - ${f}`);
}

server.close();
process.exit(failed > 0 ? 1 : 0);
