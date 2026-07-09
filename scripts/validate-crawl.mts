// scripts/validate-crawl.mts
//
// 用途：批量验证 32 个竞品站点的 HTML→Markdown 爬取效果，并落盘完整 markdown。
// 用法：node --experimental-strip-types scripts/validate-crawl.mts
//
// 抓取策略（每站最多 3 轮）：
//   Round 1: axios + 完整浏览器头（User-Agent + Accept + Accept-Language + ...）
//   Round 2: 失败时（403/429/5xx/网络）→ 有界退避重试（2s/4s/8s，最多 3 次）
//   Round 3: 仍失败 OR MD < 3 行 → Playwright 真 Chrome JA3
//   兜底：chromium 缺失时尝试自动从 npmmirror 安装一次；仍失败则写 stub MD
//
// 输出：每个站点的完整 MD 落盘到 scripts/crawl-results/{domain}.md
//       失败站点的第一轮 HTML 也落盘到 scripts/crawl-results/{domain}.html 供排查
//
// 不动 lib/scraper.ts：本次阈值（MD < 3 行）与现有 scraper 的 body-text<50 字符
// 不一致，独立成脚本避免污染生产代码；如未来需要合并到 lib/scraper.ts，再单独 Spec。

import axios from 'axios';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
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
const AXIOS_RETRIES = 3;              // axios 最大尝试次数（含首次）

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

const COMMON_HEADERS = Object.freeze({
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
});

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ---------- HTTPS Agent：不校验证书（仅 TLS SAN 错误时启用）----------

const INSECURE_AGENT = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// ---------- axios 单次执行（不带重试）----------

async function fetchViaAxiosOnce(url: string, opts: { insecure?: boolean } = {}): Promise<string> {
  const resp = await axios.get<string>(url, {
    headers: { 'User-Agent': pickUA(), ...COMMON_HEADERS },
    timeout: REQUEST_TIMEOUT_MS,
    responseType: 'text',
    transformResponse: (d) => d,
    validateStatus: (s) => s >= 200 && s < 400,
    ...(opts.insecure ? { httpsAgent: INSECURE_AGENT } : {}),
  });
  return resp.data;
}

// ---------- 错误分类 ----------

interface AxiosLikeError {
  code?: string;
  message: string;
  response?: { status?: number };
}

const RECOVERABLE_HTTP = new Set([403, 408, 425, 429, 500, 502, 503, 504, 522, 524]);

function getStatus(err: unknown): number | undefined {
  return (err as AxiosLikeError)?.response?.status;
}

function isTlsCertError(err: unknown): boolean {
  const e = err as AxiosLikeError;
  return e?.code === 'ERR_TLS_CERT_ALTNAME_INVALID'
      || e?.message?.includes('does not match certificate')
      || e?.message?.includes('Hostname/IP does not match');
}

function isRecoverableAxiosError(err: unknown): boolean {
  const status = getStatus(err);
  if (status) return RECOVERABLE_HTTP.has(status);
  // 无 status = 网络层错误（DNS / ECONNRESET / timeout），值得重试
  return true;
}

// ---------- axios 带重试 ----------

async function fetchViaAxiosWithRetry(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < AXIOS_RETRIES; attempt++) {
    try {
      return await fetchViaAxiosOnce(url);
    } catch (err) {
      lastErr = err;
      if (!isRecoverableAxiosError(err) || attempt === AXIOS_RETRIES - 1) {
        throw err;
      }
      await sleep(2_000 * 2 ** attempt); // 2s / 4s / 8s
    }
  }
  throw lastErr;
}

// ---------- TLS bypass 重试（一次性，检测到证书 SAN 错误才触发）----------

async function fetchViaAxiosInsecure(url: string): Promise<string> {
  return fetchViaAxiosOnce(url, { insecure: true });
}

// ---------- Playwright（含 chromium 缺失检测）----------

class ChromiumMissingError extends Error {
  originalErr: unknown;
  constructor(originalErr: unknown) {
    const msg = originalErr instanceof Error ? originalErr.message : String(originalErr);
    super(`ChromiumMissingError: ${msg.slice(0, 200)}`);
    this.name = 'ChromiumMissingError';
    this.originalErr = originalErr;
  }
}

function detectChromiumMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Executable doesn't exist")
      || msg.includes('browserType.launch')
      || /chrome.*not found|chromium.*not found/i.test(msg);
}

async function fetchViaPlaywright(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    if (detectChromiumMissing(err)) throw new ChromiumMissingError(err);
    throw err;
  }
  try {
    const page = await browser.newPage({ userAgent: pickUA() });
    await page.goto(url, { timeout: REQUEST_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    // 给前端 hydration 一点时间（一些 SPA 依赖客户端渲染）
    await page.waitForTimeout(2_000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

// ---------- 自动装 chromium（per-process 单例）----------

let chromiumInstallAttempted = false;
let chromiumInstallSucceeded = false;

function tryInstallChromium(): boolean {
  if (chromiumInstallAttempted) return chromiumInstallSucceeded;
  chromiumInstallAttempted = true;
  console.log('\n[chromium 缺失] 尝试从 npmmirror 安装一次...');
  try {
    execFileSync('npx', ['playwright', 'install', 'chromium'], {
      env: { ...process.env, PLAYWRIGHT_DOWNLOAD_HOST: 'https://cdn.npmmirror.com/binaries/playwright' },
      stdio: 'pipe',
      timeout: 180_000,
    });
    chromiumInstallSucceeded = true;
    console.log('[chromium 缺失] 安装成功，后续站点的 Playwright 路径会生效\n');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[chromium 缺失] 安装失败：${msg.slice(0, 200)}\n`);
    return false;
  }
}

// ---------- 工具 ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function countNonEmptyLines(md: string): number {
  return md.split('\n').filter((l) => l.trim().length > 0).length;
}

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function saveResult(name: string, suffix: string, content: string): Promise<string> {
  const filepath = path.join(OUTPUT_DIR, `${name}.${suffix}`);
  await fs.writeFile(filepath, content, 'utf8');
  return filepath;
}

async function writeStubMd(name: string, reason: string): Promise<string> {
  const content = `# ${name} — could not be fetched\n\n> ${reason}\n\n<!-- stub: scrape did not succeed; re-run scripts/validate-crawl.mts after fixing environment to overwrite -->\n`;
  return saveResult(name, 'md', content);
}

// ---------- 单站点验证 ----------

type Strategy = 'axios' | 'axios+retry' | 'axios+insecure' | 'axios→playwright' | 'playwright' | 'stub';

interface SiteResult {
  name: string;
  url: string;
  status: 'OK' | 'JS_INJECTED' | 'STILL_LOW' | 'FAIL' | 'CHROMIUM_MISSING';
  strategy: Strategy;
  mdLines: number;
  mdChars: number;
  mdPath?: string;
  htmlPath?: string;
  errorMsg?: string;
}

async function validateOne(site: { name: string; url: string }): Promise<SiteResult> {
  // === Round 1+2: axios + 完整头 + 有界重试 ===
  let html: string | undefined;
  let axiosErr: unknown;
  let usedInsecure = false;
  try {
    html = await fetchViaAxiosWithRetry(site.url);
  } catch (err) {
    axiosErr = err;
    // TLS 证书 SAN 错误 → 一次性 insecure 重试
    if (isTlsCertError(err)) {
      try {
        html = await fetchViaAxiosInsecure(site.url);
        usedInsecure = true;
        axiosErr = undefined;
      } catch (insecureErr) {
        axiosErr = insecureErr;
      }
    }
  }

  // axios 成功路径
  if (html !== undefined) {
    const md = cleanHtmlToMarkdown(html);
    const lines = countNonEmptyLines(md);
    if (lines >= MD_LINE_THRESHOLD) {
      const mdPath = await saveResult(site.name, 'md', md);
      return {
        name: site.name,
        url: site.url,
        status: 'OK',
        strategy: usedInsecure ? 'axios+insecure' : 'axios',
        mdLines: lines,
        mdChars: md.length,
        mdPath,
      };
    }
    // MD 太短 → 进 Playwright
    return runPlaywright(site, html, usedInsecure ? 'axios+insecure' : 'axios', axiosErr);
  }

  // axios 完全失败：尝试 Playwright（即便 MD 没拿到）— S4
  return runPlaywright(site, '', 'axios→playwright', axiosErr);
}

async function runPlaywright(
  site: { name: string; url: string },
  fallbackHtml: string,
  entryStrategy: Strategy,
  axiosErr: unknown,
): Promise<SiteResult> {
  try {
    const pwHtml = await fetchViaPlaywright(site.url);
    const md = cleanHtmlToMarkdown(pwHtml);
    const lines = countNonEmptyLines(md);
    const mdPath = await saveResult(site.name, 'md', md);
    return {
      name: site.name,
      url: site.url,
      status: lines >= MD_LINE_THRESHOLD ? 'JS_INJECTED' : 'STILL_LOW',
      strategy: 'playwright',
      mdLines: lines,
      mdChars: md.length,
      mdPath,
    };
  } catch (err) {
    // chromium 缺失：尝试装一次，再重试
    if (err instanceof ChromiumMissingError || detectChromiumMissing(err)) {
      const installed = tryInstallChromium();
      if (installed) {
        try {
          const pwHtml = await fetchViaPlaywright(site.url);
          const md = cleanHtmlToMarkdown(pwHtml);
          const lines = countNonEmptyLines(md);
          const mdPath = await saveResult(site.name, 'md', md);
          return {
            name: site.name,
            url: site.url,
            status: lines >= MD_LINE_THRESHOLD ? 'JS_INJECTED' : 'STILL_LOW',
            strategy: 'playwright',
            mdLines: lines,
            mdChars: md.length,
            mdPath,
          };
        } catch (retryErr) {
          // 装了之后还是失败 → 写 stub
          return makeStub(site, 'Chromium安装后 Playwright 仍失败: ' + errToMsg(retryErr), fallbackHtml);
        }
      }
      // 装不上 → stub
      return makeStub(site, 'Chromium 缺失且自动安装失败: ' + errToMsg(err), fallbackHtml);
    }

    // 其他 Playwright 错误：保留 axios 第一轮 HTML 供排查 + 写 stub
    let htmlPath: string | undefined;
    if (fallbackHtml) {
      try { htmlPath = await saveResult(site.name, 'html', fallbackHtml); } catch {}
    }
    const mdPath = await writeStubMd(site.name, 'Playwright 失败: ' + errToMsg(err));
    const axiosMsg = axiosErr ? ` [axios 错误: ${errToMsg(axiosErr).slice(0, 80)}]` : '';
    return {
      name: site.name,
      url: site.url,
      status: 'FAIL',
      strategy: entryStrategy,
      mdLines: 0,
      mdChars: 0,
      mdPath,
      htmlPath,
      errorMsg: errToMsg(err).slice(0, 100) + axiosMsg,
    };
  }
}

async function makeStub(
  site: { name: string; url: string },
  reason: string,
  fallbackHtml: string,
): Promise<SiteResult> {
  let htmlPath: string | undefined;
  if (fallbackHtml) {
    try { htmlPath = await saveResult(site.name, 'html', fallbackHtml); } catch {}
  }
  const mdPath = await writeStubMd(site.name, reason);
  return {
    name: site.name,
    url: site.url,
    status: 'CHROMIUM_MISSING',
    strategy: 'stub',
    mdLines: 0,
    mdChars: 0,
    mdPath,
    htmlPath,
    errorMsg: reason.slice(0, 120),
  };
}

function errToMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------- 串行执行 ----------

async function validateAll(): Promise<SiteResult[]> {
  const results: SiteResult[] = [];
  for (let i = 0; i < SITES.length; i++) {
    const site = SITES[i];
    process.stdout.write(`[${i + 1}/${SITES.length}] ${site.name} ... `);
    const t0 = Date.now();
    const r = await validateOne(site);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    const relPath = r.mdPath ? path.relative(process.cwd(), r.mdPath) : '-';
    process.stdout.write(`${r.status} (${r.mdLines} 行 / ${r.strategy} / ${dt}s / ${relPath})\n`);
    results.push(r);
    if (i < SITES.length - 1) {
      await sleep(RATE_LIMIT_MIN_MS + Math.random() * RATE_LIMIT_JITTER_MS);
    }
  }
  return results;
}

// ---------- 表格输出 ----------

const STATUS_LABEL: Record<SiteResult['status'], string> = {
  OK: '✓ 正常',
  JS_INJECTED: '⚠ JS注入后正常',
  STILL_LOW: '✗ JS注入仍不足',
  FAIL: '✗ 失败',
  CHROMIUM_MISSING: '⚠ chromium 缺失',
};

function printTable(results: SiteResult[]): void {
  const HEAD = [
    '| # | 站点 | 状态 | 策略 | MD 行数 | MD 字符 | MD 文件 | 备注 |',
    '|---|---|---|---|---|---|---|---|',
  ];
  const rows = results.map((r, i) => {
    const num = String(i + 1).padStart(2, ' ');
    const relPath = r.mdPath ? path.relative(process.cwd(), r.mdPath)
      : (r.htmlPath ? `(html: ${path.relative(process.cwd(), r.htmlPath)})` : '-');
    const note = r.errorMsg ? r.errorMsg.slice(0, 60) : '';
    return `| ${num} | ${r.name} | ${STATUS_LABEL[r.status]} | ${r.strategy} | ${r.mdLines} | ${r.mdChars} | ${relPath} | ${note} |`;
  });

  console.log('\n=== 验证结果 ===\n');
  console.log(HEAD.join('\n'));
  console.log(rows.join('\n'));
}

function printSummary(results: SiteResult[]): void {
  const ok = results.filter((r) => r.status === 'OK').length;
  const jsInj = results.filter((r) => r.status === 'JS_INJECTED').length;
  const stillLow = results.filter((r) => r.status === 'STILL_LOW').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const crMiss = results.filter((r) => r.status === 'CHROMIUM_MISSING').length;
  const total = results.length;

  console.log('\n=== 汇总 ===');
  console.log(`总计: ${total}  正常: ${ok}  JS注入后正常: ${jsInj}  JS注入仍不足: ${stillLow}  chromium 缺失: ${crMiss}  失败: ${fail}`);
  console.log(`完整 MD 目录: ${OUTPUT_DIR}`);

  if (fail > 0) {
    console.log('\n失败的站点:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        const info = r.htmlPath ? ` (HTML: ${path.relative(process.cwd(), r.htmlPath)})` : '';
        console.log(`  - ${r.name}: ${r.errorMsg ?? '未知错误'}${info}`);
      }
    }
  }
  if (crMiss > 0) {
    console.log('\nchromium 缺失的站点（已写 stub MD）:');
    for (const r of results) {
      if (r.status === 'CHROMIUM_MISSING') {
        console.log(`  - ${r.name}: ${r.errorMsg ?? '未知错误'}`);
      }
    }
  }
}

// ---------- 末尾验证：32 文件不变量 ----------

async function verifyFileCompleteness(results: SiteResult[]): Promise<void> {
  const files = await fs.readdir(OUTPUT_DIR);
  const mdFiles = new Set(files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));
  const missing = SITES.filter((s) => !mdFiles.has(s.name));
  const total = SITES.length;
  const ok = mdFiles.size;

  console.log('\n=== 文件完整性 ===');
  console.log(`预期 .md: ${total}  实际: ${ok}  缺失: ${missing.length}`);
  if (missing.length > 0) {
    console.log('缺失文件:');
    for (const s of missing) console.log(`  - ${s.name}.md`);
  }

  // 低质量告警：非 CHROMIUM_MISSING 状态但 MD < 3 行
  const lowQuality = results.filter((r) => r.status !== 'CHROMIUM_MISSING' && r.mdLines < MD_LINE_THRESHOLD);
  if (lowQuality.length > 0) {
    console.log('\n质量告警 (MD < 3 行 且非 chromium 缺失):');
    for (const r of lowQuality) {
      console.log(`  - ${r.name}: ${r.mdLines} 行 / ${r.status}`);
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
await verifyFileCompleteness(results);

console.log(`\n总耗时: ${elapsed}s`);
console.log(`查看全部完整 MD: ls ${OUTPUT_DIR}`);