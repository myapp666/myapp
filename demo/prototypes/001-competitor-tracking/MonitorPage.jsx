import React, { useState, useEffect } from 'react';
import styles from './MonitorPage.module.css';

/**
 * P-001: /monitor 历史记录页
 * 功能：展示监控竞对的历史变化记录，支持按 URL 筛选、时间倒序列表、详情展开
 * 对应 prototype.md §4.1 + AC-008/009/010
 */
export function MonitorPage() {
  const [urlList, setUrlList] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const [urlLoading, setUrlLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [listError, setListError] = useState(null);

  useEffect(() => {
    loadUrlList();
  }, []);

  useEffect(() => {
    if (selectedUrl) {
      loadSnapshots(selectedUrl);
    }
  }, [selectedUrl]);

  const loadUrlList = async () => {
    setUrlLoading(true);
    setUrlError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockUrls = ['example.com', 'competitor-b.com', 'new-startup.io'];
      setUrlList(mockUrls);
      if (mockUrls.length > 0) setSelectedUrl(mockUrls[0]);
    } catch (err) {
      setUrlError('无法连接到后端服务，请检查 NEXT_PUBLIC_API_BASE_URL 配置。');
    } finally {
      setUrlLoading(false);
    }
  };

  const loadSnapshots = async (url) => {
    setListLoading(true);
    setListError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      let mockSnapshots = [];
      if (url === 'example.com') {
        mockSnapshots = [
          {
            id: 1,
            crawledAt: '2026-07-07 14:30',
            changeType: '内容更新',
            summary: '产品定价页面新增 Enterprise 套餐入口，价格策略改为"联系销售"模式，原有 Pro 套餐价格保持不变。新增的企业级套餐强调了在线客服、SLA 承诺等增值服务...',
            importance: '高',
          },
          {
            id: 2,
            crawledAt: '2026-07-06 09:15',
            changeType: '新增内容',
            summary: '首页 banner 更换为新的夏季促销活动，配图和文案已更新...',
            importance: '中',
          },
          {
            id: 3,
            crawledAt: '2026-07-05 22:00',
            changeType: '小幅变化',
            summary: '页脚版权年份更新为 2026...',
            importance: '低',
          },
        ];
      } else if (url === 'competitor-b.com') {
        mockSnapshots = [
          {
            id: 4,
            crawledAt: '2026-07-07 18:45',
            changeType: '产品发布',
            summary: '发布新版本 v3.0，含 AI 助手功能和新的集成选项...',
            importance: '高',
          },
        ];
      }
      setSnapshots(mockSnapshots);
      setExpandedRows(new Set());
    } catch (err) {
      setListError('加载失败，请重试');
    } finally {
      setListLoading(false);
    }
  };

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedRows);
    newExpanded.has(id) ? newExpanded.delete(id) : newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const getImportanceClass = (imp) => {
    const map = { '高': 'high', '中': 'medium', '低': 'low' };
    return map[imp] || 'unknown';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>竞争情报监控系统</h1>
      </header>

      {urlError && (
        <div className={styles.errorBanner}>
          <span>⚠️ {urlError}</span>    <button onClick={() => loadUrlList()}>重试</button>
        </div>
      )}

      {!urlError && (
        <div className={styles.filterSection}>
          <label htmlFor="urlSelect">筛选竞对:</label>
          {urlLoading ? (
            <select disabled><option>加载中...</option></select>
          ) : urlList.length === 0 ? (
            <select disabled><option>（无可用竞对）</option></select>
          ) : (
            <select value={selectedUrl || ''} onChange={(e) => setSelectedUrl(e.target.value)}>
              {urlList.map((url) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {!urlError && urlList.length === 0 && !urlLoading && (
        <div className={styles.emptyState}>
          <p>暂无监控竞对，请在 .env 的 MONITOR_URLS 中配置目标网址</p>
        </div>
      )}

      {!urlError && selectedUrl && (
        <div className={styles.listSection}>
          <div className={styles.listHeader}>
            <h2>历史变化记录</h2>
            <span className={styles.count}>{!listLoading && `共 ${snapshots.length} 条`}</span>
          </div>

          {listLoading && <div className={styles.loadingState}><p>正在加载...</p></div>}
          {listError && !listLoading && (
            <div className={styles.errorState}>
              <p>{listError}</p>
              <button onClick={() => loadSnapshots(selectedUrl)}>重试</button>
            </div>
          )}
          {!listLoading && !listError && snapshots.length === 0 && (
            <div className={styles.emptyState}>
              <p>暂无该竞对的历史采集记录</p>
              <p className={styles.hint}>（后端将在下一个采集周期写入首条记录）</p>
            </div>
          )}

          {!listLoading && !listError && snapshots.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr><th>采集时间</th><th>变化类型</th><th>重要程度</th><th>摘要</th><th>操作</th></tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className={styles.tableRow}>
                      <td>{s.crawledAt}</td>
                      <td>[{s.changeType}]</td>
                      <td><span className={`${styles.importance} ${styles[`imp-${getImportanceClass(s.importance)}`]}`}>[{s.importance}]</span></td>
                      <td>{s.summary.length > 200 ? s.summary.substring(0, 200) + '...' : s.summary}</td>
                      <td><button className={styles.expandBtn} onClick={() => toggleExpand(s.id)}>{expandedRows.has(s.id) ? '折叠 ▲' : '展开详情 ▼'}</button></td>
                    </tr>
                    {expandedRows.has(s.id) && (
                      <tr className={styles.detailRow}>
                        <td colSpan="5"><div className={styles.detailContent}><p><strong>完整摘要：</strong></p><p>{s.summary}</p></div></td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default MonitorPage;
