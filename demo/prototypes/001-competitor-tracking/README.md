# 001-competitor-tracking Demo

## 概览

基于 `requirements/prototype.md` 的可交互 Demo，实现 **P-001 /monitor 历史记录页**。

- **版本**：v1.0（骨架 + Mock 数据）
- **状态**：可运行，支持核心交互链路
- **覆盖场景**：S-003（查阅历史记录）
- **对应 AC**：AC-008、AC-009、AC-010

---

## 快速开始

### 1. 挂载到主应用

在 `demo/src/main.jsx` 或 `demo/src/App.jsx` 中导入组件：

```jsx
import MonitorPage from './prototypes/001-competitor-tracking/MonitorPage';

// 在路由中注册
<Route path="/monitor" element={<MonitorPage />} />
```

### 2. 启动 Demo 工程

```bash
cd demo
npm install  # 如需要
npm run dev
```

打开浏览器，访问 `http://localhost:5173/monitor`

### 3. 走查核心链路

**任务：在 2 分钟内完成"找到某竞对近期变化"（≤3 步）**

1. **T-001 → T-003**：页面加载后，URL 下拉自动加载
   - 预期：显示 3 个 Mock URL
   
2. **T-004 → T-006**：选择 `example.com`（默认选中），历史列表加载
   - 预期：显示 3 条采集记录（按 crawled_at 倒序）
   - 每条显示 4 个字段：采集时间 | 变化类型 | 重要程度 | 摘要

3. **T-010 → T-011**：点击"展开详情 ▼"查看完整 summary
   - 预期：行内展开显示完整摘要

---

## 状态与交互

### 正常态（有记录）
- ✅ URL 下拉加载完成，显示全部竞对
- ✅ 列表按 crawled_at 倒序排列
- ✅ 每行展示 4 个字段 + 展开按钮
- ✅ 点击展开后行内展开详情

### 加载中
- ⏳ 初始化：URL 下拉显示"加载中..."
- ⏳ 切换 URL：列表区域显示"正在加载..."

### 空状态
- 📭 无 URL 配置：显示"暂无监控竞对"提示
- 📭 无记录：显示"暂无该竞对的历史采集记录" + 引导文本

### 错误态
- ❌ 后端不可达：顶部 banner 显示"无法连接到后端服务" + 重试按钮
- ❌ 列表加载失败：显示"加载失败，请重试" + 重试按钮

---

## Mock 数据

### URL 列表
```
- example.com
- competitor-b.com
- new-startup.io
```

### example.com 快照记录（3 条）
| 采集时间 | 变化类型 | 重要程度 | 摘要 |
|---|---|---|---|
| 2026-07-07 14:30 | 内容更新 | 高 | 产品定价页面新增 Enterprise 套餐入口... |
| 2026-07-06 09:15 | 新增内容 | 中 | 首页 banner 更换为新的夏季促销活动... |
| 2026-07-05 22:00 | 小幅变化 | 低 | 页脚版权年份更新为 2026... |

### competitor-b.com 快照记录（1 条）
| 采集时间 | 变化类型 | 重要程度 | 摘要 |
|---|---|---|---|
| 2026-07-07 18:45 | 产品发布 | 高 | 发布新版本 v3.0，含 AI 助手功能... |

### new-startup.io
- 暂无记录（空状态演示）

---

## 验证检查点

### ✅ 功能完成标准

- [x] **路由正常**：能访问 `/monitor` 页面
- [x] **URL 下拉**：加载并显示全部 Mock URL
- [x] **列表加载**：选择 URL 后加载快照记录
- [x] **字段显示**：4 字段齐全（采集时间、变化类型、重要程度、摘要）
- [x] **详情展开**：点击按钮展开/折叠完整摘要
- [x] **状态处理**：加载/空/错误状态均有相应 UI
- [x] **错误恢复**：错误状态提供"重试"按钮

### 🔄 后续替换点

当后端 API 就绪时，替换以下 Mock 逻辑：

```jsx
// 替换 loadUrlList() 中的 Mock 数据
const mockUrls = [...];
// → 改为实际 API 调用
const response = await fetch('/api/urls');
const mockUrls = await response.json();

// 替换 loadSnapshots() 中的 Mock 数据
let mockSnapshots = [...];
// → 改为实际 API 调用
const response = await fetch(`/api/snapshots?url=${encodeURIComponent(url)}`);
const mockSnapshots = await response.json();
```

---

## 验证清单（对应 prototype.md §6）

### 任务-1：查阅历史记录走查
- **目标**：2 分钟内完成"找到竞对近期变化"，≤3 步（V-003、AC-010）
- **步骤**：
  1. 打开 /mr 页面（T-001）
  2. 等待 URL 下拉加载（T-002 → T-003），选择 example.com（T-004）
  3. 等待列表加载（T-005 → T-006），查看第一条记录
  4. 展开详情查看完整摘要（T-010 → T-011）
- **成功标准**：4 个字段完整 + 可展开详情 + ≤3 步 + <2 分钟

### 任务-2：AI 解读质量抽检
- **覆盖**：V-001、AC-005
- **步骤**：展开 example.com 的记录，对比 summary 与实际变化
- **成功标准**：summary 清晰、有参考价值

---

## 文件结构

```
prototypes/001-competitor-tracking/
├── README.md（本文件）
├── index.jsx（导出入口）
├── MonitorPage.jsx（组件实现，～150 行）
└── MonitorPage.module.css（样式）
```

---

## 已知限制（MVP 范围）

- ❌ **无用户认证**：直接访问，无登录门槛（Out of scope，见 PRD §2.1）
- ❌ **无 API 集成**：使用 Mock 数据，后端可用后需替换
- ❌ **无实刷新页面重新加载（后续 v2 可加 WebSocket）
- ❌ **无分页**：最多显示 20 条记录（演示用小数据集）

---

## 后续优化方向

根据走查反馈，后续迭代可优化：

1. **交互优化**：URL 下拉搜索、记录分页、批量标记已读
2. **视觉优化**：根据设计稿补充图表、颜色、排版细节
3. **性能优化**：虚拟滚动（大数据集）、缓存加载状态
4. **功能扩展**：导出记录、设置提醒阈值、集成通知系统

---

## 反馈与问题

### 常见问题

**Q：为什么没有登录页？**  
A：MVP 阶段无认证需求（Out of scope）。详见 PRD §2.1 / prototype.md §4.1.1

**Q：后端 API 还没就绪怎么办？**  
A：当前 Demo 已用 Mock 数据支持完整走查。后端就绪后按"后续替换点"章节改动即可。

**Q：可以在 Demo 里新增功能吗？**  
A：不建议。新功能应先更新 prototype.md（R3），再在 Demo 中实现（R4），保持可追溯性。

---

## 更新日志

- **v1.0 (2026-07-08)**
  - 初版完成：MonitorPage 组件 + Mock 数据 + 样式
  - 覆盖核心链路 T-001 ~ T-011（S-003）
  - 支持所有状态演示（正常/加载/空/错误）

---

**维护者**：开发团队  
**最后更新**：2026-07-08  
**关联文件**：
- `requirements/prototype.md`（页面设计 SSOT）
- `requirements/prd.md`（需求规格）
