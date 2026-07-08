import { useState, useEffect } from "react";
import "./CompetitorsPage.css";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function CompetitorsPage({ onBack }) {
  const [competitors, setCompetitors] = useState([]);
  const [form, setForm] = useState({ name: "", url: "", industry: "", notes: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("competitors");
    if (stored) {
      try {
        setCompetitors(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.url.trim() || !validateUrl(form.url)) {
      setError("请输入有效的名称和网址");
      return;
    }
    if (competitors.some((c) => c.url === form.url)) {
      setError("该竞对已存在");
      return;
    }

    const newCompetitor = {
      id: Date.now(),
      name: form.name,
      url: form.url,
      industry: form.industry || "未分类",
      notes: form.notes || "",
      created_at: new Date().toISOString(),
    };

    const updated = [...competitors, newCompetitor];
    setCompetitors(updated);
    localStorage.setItem("competitors", JSON.stringify(updated));
    setForm({ name: "", url: "", industry: "", notes: "" });
  };

  const handleDeleteClick = (competitor) => {
    setDeleteTarget(competitor);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    const updated = competitors.filter((c) => c.id !== deleteTarget.id);
    setCompetitors(updated);
    localStorage.setItem("competitors", JSON.stringify(updated));
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  return (
    <div className="competitors-page">
      <button className="btn-back" onClick={onBack}>← 返回</button>
      <h1>竞对配置</h1>

      <div className="form-card">
        <h2>新增竞对</h2>
        <form onSubmit={handleAddCompetitor}>
          <div className="form-group">
            <label>竞对名称 *</label>
            <input name="name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="输入竞对名称" />
          </div>
          <div className="form-group">
            <label>网址 *</label>
            <input name="url" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://example.com" />
          </div>
          <div className="form-group">
            <label>行业</label>
            <input name="industry" value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} placeholder="SaaS" />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary">添加</button>
        </form>
      </div>

      <div className="table-card">
        <h2>已配置竞对 ({competitors.length})</h2>
        {competitors.length === 0 ? (
          <p className="empty-text">暂未配置竞对，请在上方添加。</p>
        ) : (
          <table className="competitors-table">
            <thead>
          <tr><th>名称</th><th>网址</th><th>行业</th><th>操作</th></tr>
            </thead>
            <tbody>
              {competitors.map((comp) => (
                <tr key={comp.id}>
                  <td>{comp.name}</td>
                  <td><a href={comp.url} target="_blank" rel="noopener noreferrer">{comp.url}</a></td>
                  <td>{comp.industry}</td>
                  <td><button className="btn-delete" onClick={() => handleDeleteClick(comp)}>删除</button></td>
              </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDeleteModal && deleteTarget && (
        <DeleteConfirmModal competitor={deleteTarget} onConfirm={handleConfirmDelete} onCancel={() => setShowDeleteModal(false)} />
      )}
    </div>
  );
}
