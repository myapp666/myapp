// P-001 /monitor 历史记录页
// prototype.md §4.1 — 覆盖 AC-008 / AC-009 / AC-010
import { useState, useEffect, useCallback, Fragment } from "react";
import { fetchUrls, fetchSnapshots } from "./api.js";
import { IMPORTANCE_LABEL, IMPORTANCE_CLASS } from "./mockData.js";
import "./MonitorPage.css";

function formatDate(isoStr) {
  // AC-009: YYYY-MM-DD HH:mm
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncate(text, max = 200) {
  // AC-009: summary 截断 200 字
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function isAiError(text) {
  return typeof text === "string" && text.startsWith("[AI 解读失败");
}

export default function MonitorPage() {
  // --- URL 列表状态 ---
  const [urls, setUrls] = useState([]);
  const [urlsLoading, setUrlsLoading] = useState(true);
  const [urlsError, setUrlsError] = useState(null);

  // --- 选中 URL ---
  const [selectedUrl, setSelectedUrl] = useState(null);

  // --- 历史记录状态 ---
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState(null);

  // --- 展开详情 ---
  const [expandedIds, setExpandedIds] = useState(new Set());

  // T-001/T-002: 页面初始化，加载 URL 列表
  const loadUrls = useCallback(async () => {
    setUrlsLoading(true);
    setUrlsError(null);
    try {
      const data = await fetchUrls();
      setUrls(data);
      // AC-008: 默认选中第一项
      if (data.length > 0) setSelectedUrl(data[0].url);
    } catch (e) {
      setUrlsError(e.message);
    } finally {
      setUrlsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUrls();
  }, [loadUrls]);

  // T-004/T-005: 切换 URL 时加载历史记录
  const loadRecords = useCallback(async (url) => {
    if (!url) return;
    setRecordsLoading(true);
    setRecordsError(null);
    setExpandedIds(new Set());
    try {
      const data = await fetchSnapshots(url);
      setRecords(data);
    } catch (e) {
      setRecordsError(e.message);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUrl) loadRecords(selectedUrl);
  }, [selectedUrl, loadRecords]);

  // T-010/T-011: 展开/折叠详情
  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // --- 渲染 ---

  // URL 列表加载失败（异常-4）
  if (urlsError) {
    return (
      <div className="monitor-page">
        <h1>竞争情报监控系统</h1>
        <div className="error-banner">
          <span>⚠ 无法连接到后端服务，请检查 VITE_API_BASE_URL 配置。（{urlsError}）</span>
          <button onClick={loadUrls}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="monitor-page">
      <h1>竞争情报监控系统</h1>

      {/* 筛选区 — AC-008, AC-010 步骤1+2 */}
      <div className="filter-bar">
        <label htmlFor="url-select">筛选竞对:</label>
        {urlsLoading ? (
          <span style={{ fontSize: 14, color: "#888" }}>加载中…</span>
        ) : urls.length === 0 ? (
          <span style={{ fontSize: 14, color: "#888" }}>
            暂无监控竞对，请在 .env 的 MONITOR_URLS 中配置目标网址
          </span>
        ) : (
          <select
            id="url-select"
            value={selectedUrl || ""}
            onChange={(e) => setSelectedUrl(e.target.value)}
          >
            {urls.map((u) => (
              <option key={u.id} value={u.url}>
                {u.url}{u.name ? ` (${u.name})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 历史记录区 */}
      {selectedUrl && (
        <>
          <div className="records-header">
            <h2>历史变化记录</h2>
            {!recordsLoading && !recordsError && (
              <span className="records-count">共 {records.length} 条</span>
            )}
          </div>

          {/* 加载状态 */}
          {recordsLoading && (
            <div className="state-box">正在加载…</div>
          )}

          {/* 列表请求失败 */}
          {!recordsLoading && recordsError && (
            <div className="state-box">
              <div>⚠ 加载失败：{recordsError}</div>
              <button className="retry-btn" onClick={() => loadRecords(selectedUrl)}>
                重试
              </button>
            </div>
          )}

          {/* 空状态 — AC-008 */}
          {!recordsLoading && !recordsError && records.length === 0 && (
            <div className="state-box">
              <div>暂无该竞对的历史采集记录</div>
              <div style={{ marginTop: 6, color: "#aaa", fontSize: 13 }}>
                后端将在下一个采集周期写入首条记录
              </div>
            </div>
          )}

          {/* 正常列表 — AC-008/AC-009/AC-010 */}
          {!recordsLoading && !recordsError && records.length > 0 && (
            <table className="records-table">
              <thead>
                <tr>
                  <th>采集时间</th>
                  <th>变化类型</th>
                  <th>重要程度</th>
                  <th>摘要</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isExpanded = expandedIds.has(r.id);
                  const imp = r.importance || "unknown";
                  const aiError = isAiError(r.summary);
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        {/* AC-009: crawled_at YYYY-MM-DD HH:mm */}
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDate(r.crawled_at)}
                        </td>
                        {/* AC-009: change_type 标签 */}
                        <td>
                          <span className={`tag${aiError ? " tag-ai-error" : ""}`}>
                            {r.change_type || "—"}
                          </span>
                        </td>
                        {/* AC-009: importance 低/中/高 */}
                        <td>
                          <span className={IMPORTANCE_CLASS[imp] || "importance-unknown"}>
                            {IMPORTANCE_LABEL[imp] || imp}
                          </span>
                        </td>
                        {/* AC-009: summary 截断 200 字 + 展开按钮 */}
                        <td className="summary-cell">
                          <div className="summary-truncated">
                            {truncate(r.summary)}
                          </div>
                          {r.summary && r.summary.length > 200 && (
                            <button
                              className="expand-btn"
                              onClick={() => toggleExpand(r.id)}
                            >
                              {isExpanded ? "折叠 ▲" : "展开详情 ▼"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* 行内展开详情 — T-010/T-011 */}
                      {isExpanded && (
                        <tr className="detail-row">
                          <td colSpan={4}>
                            <div className="detail-box">{r.summary}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
