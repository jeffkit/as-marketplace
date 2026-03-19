# LAVS View 组件 UI 模板库

根据数据类型选择合适的模板，然后替换对应的 endpoint ID 和字段名。

---

## 模板 1：列表管理（通用）

适用场景：待办事项、笔记、联系人、任务清单

特征：卡片列表 + 状态标签 + 操作按钮

```html
<!-- 在 renderItem() 中替换 -->
function renderItem(item) {
  const statusColors = {
    'active': '#22c55e', 'done': '#94a3b8',
    'pending': '#f59e0b', 'error': '#ef4444'
  };
  const color = statusColors[item.status] || '#64748b';
  return `
    <div class="item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:500">${item.title || item.name || item.id}</span>
        <span style="font-size:12px;color:${color};background:${color}20;
          padding:2px 8px;border-radius:999px">${item.status || '—'}</span>
      </div>
      ${item.description ? `<p style="font-size:13px;color:#64748b;margin-top:6px">${item.description}</p>` : ''}
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">
        ${item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : ''}
      </div>
    </div>
  `;
}
```

---

## 模板 2：看板（Kanban）

适用场景：项目管理、工作流、多状态任务

特征：多列看板，拖拽感 UI

```html
<!-- 在 render() 中完全替换 -->
function render(items) {
  const columns = {
    'todo': { label: '待办', color: '#64748b' },
    'doing': { label: '进行中', color: '#3b82f6' },
    'done': { label: '已完成', color: '#22c55e' }
  };

  const content = document.getElementById('content');
  content.style.display = 'grid';
  content.style.gridTemplateColumns = 'repeat(3, 1fr)';
  content.style.gap = '12px';
  content.className = '';

  content.innerHTML = Object.entries(columns).map(([key, col]) => {
    const colItems = items.filter(i => (i.status || 'todo') === key);
    return `
      <div style="background:white;border-radius:10px;padding:12px;border:1px solid #e2e8f0">
        <div style="font-weight:600;color:${col.color};margin-bottom:10px">
          ${col.label} <span style="font-size:12px;color:#94a3b8">(${colItems.length})</span>
        </div>
        ${colItems.map(item => `
          <div style="background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:8px;
            font-size:13px;border-left:3px solid ${col.color}">
            <div style="font-weight:500">${item.title || item.name}</div>
            ${item.description ? `<div style="color:#64748b;margin-top:4px">${item.description}</div>` : ''}
          </div>
        `).join('')}
        ${colItems.length === 0 ? '<div style="text-align:center;color:#cbd5e1;padding:16px;font-size:12px">空</div>' : ''}
      </div>
    `;
  }).join('');
}
```

---

## 模板 3：数据表格

适用场景：库存、财务数据、日志记录

特征：表格展示，支持多字段

```html
<!-- 完整的 render 函数替换 -->
function render(items) {
  const content = document.getElementById('content');
  if (items.length === 0) {
    content.innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }
  // 动态获取所有字段名（排除系统字段）
  const excludeKeys = ['id', 'createdAt', 'updatedAt'];
  const keys = Object.keys(items[0]).filter(k => !excludeKeys.includes(k));

  content.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f1f5f9">
          ${keys.map(k => `<th style="padding:8px 12px;text-align:left;font-weight:600;
            color:#475569;border-bottom:1px solid #e2e8f0">${k}</th>`).join('')}
          <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8f0">时间</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr style="border-bottom:1px solid #f1f5f9">
            ${keys.map(k => `<td style="padding:8px 12px;color:#334155">${item[k] ?? '—'}</td>`).join('')}
            <td style="padding:8px 12px;text-align:right;color:#94a3b8;white-space:nowrap">
              ${item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
```

---

## 模板 4：指标仪表盘

适用场景：数据统计、KPI 监控

特征：大数字 + 趋势指示

```html
<!-- 在 render() 前添加统计计算，然后展示 -->
function render(items) {
  const content = document.getElementById('content');
  const total = items.length;
  const done = items.filter(i => i.status === 'done').length;
  const rate = total > 0 ? Math.round(done / total * 100) : 0;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      ${[
        { label: '总计', value: total, color: '#3b82f6' },
        { label: '已完成', value: done, color: '#22c55e' },
        { label: '完成率', value: rate + '%', color: '#8b5cf6' }
      ].map(stat => `
        <div style="background:white;border-radius:10px;padding:16px;text-align:center;
          border:1px solid #e2e8f0">
          <div style="font-size:28px;font-weight:700;color:${stat.color}">${stat.value}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">${stat.label}</div>
        </div>
      `).join('')}
    </div>
    <div class="list">
      ${items.slice(0, 5).map(item => renderItem(item)).join('')}
    </div>
  `;
}
```

---

## 选择建议

| 数据类型 | 推荐模板 |
|---------|---------|
| 待办/任务/笔记 | 模板 1（列表） |
| 项目/工作流 | 模板 2（看板） |
| 表格数据/记录 | 模板 3（表格） |
| 统计/监控 | 模板 4（仪表盘） |
| 自定义 | 从模板 1 开始改 |
