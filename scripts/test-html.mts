// scripts/test-html.mts
// 用法：node --experimental-strip-types scripts/test-html.mts
// 覆盖 AC-1 ~ AC-7（V-001 / V-002 / V-003）；无需真实 API Key。
//
// 策略：
// - cleanHtmlToMarkdown 直接调用（AC-1/2/3）
// - analyzeHtml 通过本地 mock HTTP server 拦截（AC-4/5/6/7）
// - env 在 dynamic import 之前设置，让 lib/html.ts 读到我们的 mock URL

import http from 'node:http';
import type { AddressInfo } from 'node:net';

// ---------- 启动 mock HTTP server ----------

type MockBehavior =
  | { mode: 'ok_json'; payload: object }
  | { mode: 'ok_text'; text: string }
  | { mode: 'throw_status'; status: number; body: string }
  | { mode: 'hang' };

let nextBehavior: MockBehavior = { mode: 'ok_json', payload: {} };
let capturedPrompt = ''; // 每次请求都会被覆盖；AC-7 用它断言 prompt 内容

const server = http.createServer((req, res) => {
  // 读取 body（Anthropic SDK 会 POST JSON）
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    // 始终捕获最近一次请求的 prompt（用于 AC-7 截断断言）
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
    if (beh.mode === 'hang') {
      // 不响应，强制超时
      return;
    }
    // 构造一个 Anthropic Messages API 形态的响应
    const text =
      beh.mode === 'ok_json'
        ? JSON.stringify(beh.payload)
        : beh.text;
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
      })
    );
  });
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

// ---------- 在 import lib/html.ts 之前设置 env ----------

process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}/v1`;
// 给 apiKey 一个非空值，避免 SDK 内部校验失败
process.env.AI_API_KEY = 'mock-key-for-test';

// dynamic import：env 已就位
const { cleanHtmlToMarkdown, analyzeHtml } = await import('../lib/html.ts');

// ---------- 测试框架（极简，无依赖）----------

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
  try {
    await fn();
  } catch (err) {
    failed++;
    failures.push(`${name}: threw ${err instanceof Error ? err.message : String(err)}`);
    console.log(`  ✗ threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------- AC-1：标准 HTML → MD ----------

await runCase('AC-1 cleanHtmlToMarkdown 标准输入', () => {
  const md = cleanHtmlToMarkdown('<h1>Hello</h1><p>World</p>');
  assert(md === '# Hello\n\nWorld', `输出严格等于 "# Hello\\n\\nWorld"，实际：${JSON.stringify(md)}`);
});

// ---------- AC-2：空字符串 ----------

await runCase('AC-2 cleanHtmlToMarkdown 空字符串', () => {
  const md = cleanHtmlToMarkdown('');
  assert(md === '', `输出严格等于 ""，实际：${JSON.stringify(md)}`);
});

// ---------- AC-3：纯文本无标签 ----------

await runCase('AC-3 cleanHtmlToMarkdown 纯文本', () => {
  const md = cleanHtmlToMarkdown('纯文本无标签');
  assert(md === '纯文本无标签', `原样返回，实际：${JSON.stringify(md)}`);
});

// ---------- AC-4：mock 返回合法 JSON → 完整 HtmlAnalysis ----------

await runCase('AC-4 analyzeHtml mock 合法 JSON', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { content_type: '文章', summary: '本文介绍 Server Actions', importance: '中' },
  };
  const result = await analyzeHtml('# Hello\n\nSome markdown content here for testing purposes.');
  assert(result.content_type === '文章', `content_type === "文章"，实际：${result.content_type}`);
  assert(result.summary === '本文介绍 Server Actions', `summary 匹配`);
  assert(result.importance === '中', `importance === "中"，实际：${result.importance}`);
});

// ---------- AC-5：mock 抛错 → 兜底结构体 ----------

await runCase('AC-5 analyzeHtml mock 500 错误', async () => {
  nextBehavior = { mode: 'throw_status', status: 500, body: '{"error":"internal"}' };
  const result = await analyzeHtml('# Test');
  assert(result.content_type === '其他', `content_type === "其他"，实际：${result.content_type}`);
  assert(result.summary.startsWith('[AI 解读失败'), `summary 以 [AI 解读失败 开头，实际：${result.summary.slice(0, 30)}`);
  assert(result.importance === '低', `importance === "低"，实际：${result.importance}`);
});

// ---------- AC-6：mock 返回缺字段的 JSON → 字段缺失兜底 ----------

await runCase('AC-6 analyzeHtml mock 缺字段', async () => {
  nextBehavior = {
    mode: 'ok_json',
    payload: { content_type: '文章' }, // 缺 summary 和 importance
  };
  const result = await analyzeHtml('# Test');
  assert(result.content_type === '文章', `content_type === "文章"，实际：${result.content_type}`);
  assert(result.summary === '', `summary 兜底为 ""，实际：${JSON.stringify(result.summary)}`);
  assert(result.importance === '低', `importance 兜底为 "低"，实际：${result.importance}`);
});

// ---------- AC-7：超长输入截断（>15000 字符）----------

await runCase('AC-7 analyzeHtml 超长输入截断', async () => {
  // 重置捕获（避免上一次请求的残留）
  capturedPrompt = '';
  // mock 返回预期的 JSON
  nextBehavior = {
    mode: 'ok_json',
    payload: { content_type: '文档', summary: '已截断测试', importance: '低' },
  };
  // 输入 20000 字符的 MD（> 15000 上限）
  const longMd = 'A'.repeat(20000);
  const result = await analyzeHtml(longMd);

  assert(capturedPrompt.includes('[输入已截断至 15000 字符'), `prompt 含截断提示，实际前 100 字符：${capturedPrompt.slice(0, 100)}`);
  assert(!capturedPrompt.includes('A'.repeat(16000)), `prompt 中不应出现未截断的长串 A`);
  assert(result.content_type === '文档', `content_type === "文档"，实际：${result.content_type}`);
  assert(result.summary === '已截断测试', `summary 正常返回`);
  assert(result.importance === '低', `importance === "低"`);
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