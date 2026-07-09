// scripts/validate-crawl.mts
//
// 用途：批量验证 32 个竞品站点的 HTML→Markdown 爬取效果，并落盘完整 markdown。
// 用法：node --experimental-strip-types scripts/validate-crawl.mts
//
// 策略：
// - 第一轮：axios 直接抓 HTML → cleanHtmlToMarkdown → 数非空行
// - 若 MD 非空行 < 3 → 第二轮：Playwright 渲染抓 → 再转 MD
// - 每个站点的完整 MD 落盘到 scripts/crawl-results/{domain}.md
// - 失败站点的原始 HTML 也落盘到 scripts/crawl-results/{domain}.html 供排查
// - 输出：stdout 打印精简表格（状态 + 行数 + 字符数 + 文件路径），不含预览
//
// 不动 lib/scraper.ts：本次阈值（MD < 3 行）与现有 scraper 的 body-text<50 字符
// 不一致，独立成脚本避免污染生产代码；如未来需要合并到 lib/scraper.ts，再单独 Spec。

import axios from 'axios';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cleanHtmlToMarkdown } from '../lib/html.ts';

// ---------- 输出目录 ----------

const OUTPUT_DIR = path.resolve('scripts/crawl-results');

// ---------- 站点清单（手动维护；与产品要求一致）----------

const SITES: ReadonlyArray<{ name: string; url: string }> = [
  { name: 'ihuiwa.com',       url: 'https://ihuiwa.com' },
  { name: 'x-design.com',     url: 'https://x-design.com' },
  { name: 'piccopilot.com',   url: 'https://piccopilot.com' },
  { name: 'weshop.ai',        url: 'https://weshop.ai' },
  { name: 'bandy.ai',         url: 'https://bandy.ai' },
  { name: 'thenewblack.ai',   url: 'https://thenewblack.ai' },
  { name: 'lovable.dev',      url: 'https://lovable.dev' },
  { name: 'cursor.com',       url: 'https://cursor.com' },
  { name: 'bolt.new',         url: 'https://bolt.new' },
  { name: 'ai.refine.dev',    url: 'https://ai.refine.dev' },
  { name: 'create.xyz',       url: 'https://create.xyz' },
  { name: 'sellerpic.ai',     url: 'https://sellerpic.ai' },
  { name: 'lensmor.com',      url: 'https://lensmor.com' },
  { name: 'klingai.com',      url: 'https://klingai.com' },
  { name: 'photoroom.com',    url: 'https://photoroom.com' },
  { name: 'smartli.ai',       url: 'https://smartli.ai' },
  { name: 'flair.ai',         url: 'https://flair.ai' },
  { name: 'pebblely.com',     url: 'https://pebblely.com' },
  { name: 'claid.ai',         url: 'https://claid.ai' },
  { name: 'vidfly.ai',        url: 'https://vidfly.ai' },
  { name: 'picsart.com',      url: 'https://picsart.com' },
  { name: 'headsup.bot',      url: 'https://headsup.bot' },
  { name: 'hla.com.cn',       url: 'https://hla.com.cn' },
  { name: 'gemini.com',       url: 'https://gemini.com' },
  { name: 'ziniao.com',       url: 'https://ziniao.com' },
  { name: 'tenable.com',      url: 'https://tenable.com' },
  { name: 'getpeerpanda.com', url: 'https://getpeerpanda.com' },
  { name: 'fruitful.app',     url: 'https://fruitful.app' },
  { name: 'usehindsight.com', url: 'https://usehindsight.com' },
  { name: 'media.io',         url: 'https://media.io' },
  { name: 'airtable.com',     url: 'https://airtable.com' },
  { name: 'lessie.ai',        url: 'https://lessie.ai' },
];

// ---------- 配置 ----------

const MD_LINE_THRESHOLD = 3;          // MD 非空行 < 此值 → 触发 JS 注入
const REQUEST_TIMEOUT_MS = 30_000;    // 单次 HTTP 超时
const RATE_LIMIT_MIN_MS = 3_000;      // 站点间最小间隔（避免被反爬封）
const RATE_LIMIT_JITTER_MS = 2_000;   // 随机抖动

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------- 抓取：axios 第一轮 ----------

async function fetchViaAxios(url: string): Promise<string> {
  const resp = await axios.get<string>(url, {
    headers: { 'User-Agent': pickUA() },
    timeout: REQUEST_TIMEOUT_MS,
    responseType: 'text',
    transformResponse: (d) => d,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return resp.data;
}

// ---------- 抓取：Playwright 第二轮 ----------

async function fetchViaPlaywright(url: string): Promise<string> {
  // 动态 import：避免冷启动/无 playwright 环境时直接报错
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: pickUA() });
    await page.goto(url, { timeout: REQUEST_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    // 给前端 hydration 一点时间（一些 SPA 依赖客户端渲染）
    await page.waitForTimeout(2_000);
    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

// ---------- 工具：MD 行数统计 ----------

function countNonEmptyLines(md: string): number {
  return md.split('\n').filter((l) => l.trim().length > 0).length;
}

// ---------- 落盘 ----------

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function saveResult(name: string, suffix: string, content: string): Promise<string> {
  const filename = `${name}.${suffix}`;
  const filepath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(filepath, content, 'utf8');
  return filepath;
}

// ---------- 单站点验证 ----------

interface SiteResult {
  name: string;
  url: string;
  status: 'OK' | 'JS_INJECTED' | 'STILL_LOW' | 'FAIL';
  mdLines: number;
  mdChars: number;
  mdPath?: string;          // 落盘路径
  htmlPath?: string;        // 原始 HTML 落盘路径（FAIL 排查用）
  errorMsg?: string;
}

async function validateOne(site: { name: string; url: string }): Promise<SiteResult> {
  // 第一轮：axios
  let html: string;
  let usedJsInject = false;
  try {
    html = await fetchViaAxios(site.url);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    return {
      name: site.name,
      url: site.url,
      status: 'FAIL',
      mdLines: 0,
      mdChars: 0,
      errorMsg: errMsg,
    };
  }

  let md = cleanHtmlToMarkdown(html);
  let lines = countNonEmptyLines(md);

  // 第二轮：MD 行数不够 → JS 注入
  if (lines < MD_LINE_THRESHOLD) {
    usedJsInject = true;
    try {
      html = await fetchViaPlaywright(site.url);
      md = cleanHtmlToMarkdown(html);
      lines = countNonEmptyLines(md);
    } catch (err) {
      // JS 注入失败：先把已抓到的第一轮 HTML 落盘供排查
      let htmlPath: string | undefined;
      try { htmlPath = await saveResult(site.name, 'html', html); } catch {}
      const errMsg = 'JS注入失败: ' + (err instanceof Error ? err.message : String(err)).slice(0, 80);
      let mdPath: string | undefined;
      try { mdPath = await saveResult(site.name, 'md', md); } catch {}
      return {
        name: site.name,
        url: site.url,
        status: 'FAIL',
        mdLines: lines,
        mdChars: md.length,
        mdPath,
        htmlPath,
        errorMsg: errMsg,
      };
    }
  }

  // 落盘完整 MD
  let mdPath: string | undefined;
  try { mdPath = await saveResult(site.name, 'md', md); } catch {}

  return {
    name: site.name,
    url: site.url,
    status: usedJsInject ? (lines >= MD_LINE_THRESHOLD ? 'JS_INJECTED' : 'STILL_LOW') : 'OK',
    mdLines: lines,
    mdChars: md.length,
    mdPath,
  };
}

// ---------- 串行执行（带站点间间隔）----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function validateAll(): Promise<SiteResult[]> {
  const results: SiteResult[] = [];
  for (let i = 0; i < SITES.length; i++) {
    const site = SITES[i];
    process.stdout.write(`[${i + 1}/${SITES.length}] ${site.name} ... `);
    const t0 = Date.now();
    const r = await validateOne(site);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const relPath = r.mdPath ? path.relative(process.cwd(), r.mdPath) : '-';
    process.stdout.write(`${r.status} (${r.mdLines} 行 / ${dt}s / ${relPath})\n`);
    results.push(r);
    // 站点间 sleep（最后一个不睡）
    if (i < SITES.length - 1) {
      await sleep(RATE_LIMIT_MIN_MS + Math.random() * RATE_LIMIT_JITTER_MS);
    }
  }
  return results;
}

// ---------- 表格输出（精简：不含预览） ----------

function printTable(results: SiteResult[]): void {
  const HEAD = [
    '| # | 站点 | 状态 | MD 行数 | MD 字符 | MD 文件 | 备注 |',
    '|---|---|---|---|---|---|---|',
  ];
  const rows = results.map((r, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const status =
      r.status === 'OK' ? '✓ 正常' :
      r.status === 'JS_INJECTED' ? '⚠ JS注入后正常' :
      r.status === 'STILL_LOW' ? '✗ JS注入仍不足' :
      '✗ 失败';
    const relPath = r.mdPath ? path.relative(process.cwd(), r.mdPath) : (r.htmlPath ? `(html: ${path.relative(process.cwd(), r.htmlPath)})` : '-');
    const note = r.errorMsg ? r.errorMsg : '';
    return `| ${num} | ${r.name} | ${status} | ${r.mdLines} | ${r.mdChars} | ${relPath} | ${note} |`;
  });

  console.log('\n=== 验证结果 ===\n');
  console.log(HEAD.join('\n'));
  console.log(rows.join('\n'));
}

// ---------- 汇总统计 ----------

function printSummary(results: SiteResult[]): void {
  const ok = results.filter((r) => r.status === 'OK').length;
  const jsInj = results.filter((r) => r.status === 'JS_INJECTED').length;
  const stillLow = results.filter((r) => r.status === 'STILL_LOW').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  console.log('\n=== 汇总 ===');
  console.log(`总计: ${total}  正常: ${ok}  JS注入后正常: ${jsInj}  JS注入仍不足: ${stillLow}  失败: ${fail}`);
  console.log(`完整 MD 目录: ${OUTPUT_DIR}`);

  if (jsInj + stillLow > 0) {
    console.log('\n需要 JS 注入的站点:');
    for (const r of results) {
      if (r.status === 'JS_INJECTED' || r.status === 'STILL_LOW') {
        console.log(`  - ${r.name} (注入后 ${r.mdLines} 行)`);
      }
    }
  }
  if (fail > 0) {
    console.log('\n失败的站点:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        const info = r.htmlPath ? ` (HTML 排查: ${path.relative(process.cwd(), r.htmlPath)})` : '';
        console.log(`  - ${r.name}: ${r.errorMsg ?? '未知错误'}${info}`);
      }
    }
  }
}

// ---------- main ----------

await ensureOutputDir();

console.log(`=== 验证爬取 markdown 效果 ===`);
console.log(`站点数: ${SITES.length}  MD 行数阈值: ${MD_LINE_THRESHOLD}  站点间间隔: ${RATE_LIMIT_MIN_MS}~${RATE_LIMIT_MIN_MS + RATE_LIMIT_JITTER_MS}ms`);
console.log(`完整 MD 输出目录: ${OUTPUT_DIR}`);
console.log(`预估耗时: ${Math.ceil((SITES.length * RATE_LIMIT_MIN_MS) / 1000)}s ~ ${Math.ceil((SITES.length * (RATE_LIMIT_MIN_MS + RATE_LIMIT_JITTER_MS)) / 1000)}s（不含单站请求时间）\n`);

const t0 = Date.now();
const results = await validateAll();
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

printTable(results);
printSummary(results);

console.log(`\n总耗时: ${elapsed}s`);
console.log(`查看全部完整 MD: ls ${OUTPUT_DIR}`);