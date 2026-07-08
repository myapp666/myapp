import axios from 'axios';
import * as cheerio from 'cheerio';
import { createTwoFilesPatch } from 'diff';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

const lastFetchTimes = new Map<string, number>();

function getDomain(url: string): string {
  return new URL(url).hostname;
}

async function respectRateLimit(url: string): Promise<void> {
  const domain = getDomain(url);
  const last = lastFetchTimes.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  const delay = (10 + Math.random() * 20) * 1000; // 10–30s in ms
  if (elapsed < delay) {
    await new Promise((r) => setTimeout(r, delay - elapsed));
  }
  lastFetchTimes.set(domain, Date.now());
}

async function fetchWithPlaywright(url: string): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
  });
  await page.goto(url, { timeout: 30_000 });
  const content = await page.content();
  await browser.close();
  return content;
}

async function fetchOnce(url: string): Promise<string> {
  // Vercel Serverless 跳过 Playwright（50MB 函数大小限制会炸）
  if (process.env.VERCEL) {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const resp = await axios.get<string>(url, {
      headers: { 'User-Agent': ua },
      timeout: 30_000,
      responseType: 'text',
    });
    return resp.data;
  }

  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const resp = await axios.get<string>(url, {
    headers: { 'User-Agent': ua },
    timeout: 30_000,
    responseType: 'text',
  });
  const html: string = resp.data;
  const $ = cheerio.load(html);
  const bodyText = $('body').text().trim();
  if (bodyText.length < 50) {
    return fetchWithPlaywright(url);
  }
  return html;
}

export async function fetchHtml(url: string, retries = 3): Promise<string> {
  await respectRateLimit(url);
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchOnce(url);
    } catch (err) {
      lastError = err;
      const wait = Math.min(4 * 2 ** i, 60) * 1000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}

export function diffHtml(oldHtml: string, newHtml: string): string {
  if (oldHtml === newHtml) return '';
  return createTwoFilesPatch('old', 'new', oldHtml, newHtml, '', '', { context: 3 });
}
