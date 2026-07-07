// API 层 — 真实数据接入替换点
// 当后端 FastAPI 就绪后，将 USE_MOCK 改为 false，
// 并在环境变量 VITE_API_BASE_URL 中设置后端地址（对应 NEXT_PUBLIC_API_BASE_URL）
import { MOCK_URLS, MOCK_SNAPSHOTS } from "./mockData.js";

const USE_MOCK = true;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchUrls() {
  if (USE_MOCK) {
    await sleep(400);
    return MOCK_URLS;
  }
  if (!API_BASE) throw new Error("VITE_API_BASE_URL 未配置");
  const res = await fetch(`${API_BASE}/api/urls`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSnapshots(url) {
  if (USE_MOCK) {
    await sleep(600);
    return MOCK_SNAPSHOTS[url] ?? [];
  }
  if (!API_BASE) throw new Error("VITE_API_BASE_URL 未配置");
  const res = await fetch(
    `${API_BASE}/api/snapshots?url=${encodeURIComponent(url)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
