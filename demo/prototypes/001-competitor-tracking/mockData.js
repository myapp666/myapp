// MOCK DATA — 真实数据接入替换点：替换为 GET /api/urls 和 GET /api/snapshots 的实际响应
// 对应 prototype.md §4.1.2 / §4.1.3

export const MOCK_URLS = [
  { id: 1, url: "https://competitor-a.com", name: "Competitor A" },
  { id: 2, url: "https://competitor-b.com", name: "Competitor B" },
  { id: 3, url: "https://no-records.example.com", name: "No Records Site" },
];

export const MOCK_SNAPSHOTS = {
  "https://competitor-a.com": [
    {
      id: 101,
      crawled_at: "2026-07-07T14:30:00",
      change_type: "内容更新",
      importance: "high",
      summary:
        '产品定价页面新增了 Enterprise 套餐入口，价格策略由固定定价改为"联系销售"模式，原有 Pro 套餐价格保持不变。页面底部新增了客户案例区块，展示了 3 家标杆客户 logo。整体页面结构调整较大，主要聚焦于转化漏斗优化。此外，FAQ 区块新增了 5 条关于 Enterprise 方案的常见问题，包括合同周期、席位数量限制、SSO 支持及 SLA 保障说明，整体调整方向与近期销售策略向大客户倾斜的趋势一致，值得持续关注后续落地效果。',
    },
    {
      id: 102,
      crawled_at: "2026-07-06T09:15:00",
      change_type: "新增内容",
      importance: "medium",
      summary:
        '首页 banner 更换为新产品发布主题，突出 AI 功能卖点。导航栏新增"解决方案"下拉菜单，包含按行业分类的子菜单项。',
    },
    {
      id: 103,
      crawled_at: "2026-07-05T22:00:00",
      change_type: "小幅变化",
      importance: "low",
      summary: "页脚版权年份更新为 2026，以及隐私政策链接文案微调。",
    },
    {
      id: 104,
      crawled_at: "2026-07-04T08:00:00",
      change_type: "内容更新",
      importance: "high",
      summary:
        "博客新增 3 篇技术文章，主题涵盖 RAG 架构、向量数据库选型与大模型微调实践。首页博客推荐区同步更新。文章质量较高，可能是为下一次市场活动做内容储备。",
    },
    {
      id: 105,
      crawled_at: "2026-07-03T14:00:00",
      change_type: "[AI 解读失败，原因: API timeout]",
      importance: "unknown",
      summary: "[AI 解读失败，原因: API timeout]",
    },
  ],
  "https://competitor-b.com": [
    {
      id: 201,
      crawled_at: "2026-07-07T10:00:00",
      change_type: "新增内容",
      importance: "medium",
      summary: "招聘页面新增 12 个职位，主要集中在前端工程师和销售岗位，暗示团队扩张中。",
    },
  ],
  "https://no-records.example.com": [],
};

export const IMPORTANCE_LABEL = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未知",
};

export const IMPORTANCE_CLASS = {
  high: "importance-high",
  medium: "importance-medium",
  low: "importance-low",
  unknown: "importance-unknown",
};
