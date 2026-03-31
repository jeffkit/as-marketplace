---
name: lavs-agent-dev
description: 创建符合 LAVS 规范的 AgentStudio Agent，包含数据存储、API endpoints 和可视化 UI。适用于「管理某类数据」、「带看板/仪表盘界面」、「需要 AI + 可视化双界面」等场景。触发关键词：创建 LAVS Agent、带可视化界面的 Agent、lavs.json、数据管理 Agent。
additionalFiles:
  - path: reference/templates.md
  - path: reference/ui-templates.md
---

# LAVS Agent 开发指南

创建 AgentStudio Agent 并集成 **LAVS (Local Agent View Service)** — 让 Agent 同时拥有对话界面和可视化数据界面。

## 引导式对话流程

### Step 1：需求收集（最多 3 轮）

根据用户描述详细度动态调整：

1. **管理什么数据**？（待办、笔记、库存、联系人...）
2. **需要哪些操作**？（增删改查、搜索、筛选...）
3. **UI 风格**？（列表、看板、表格、仪表盘 — 见 `reference/ui-templates.md`）
4. **项目路径**？

### Step 2：生成预览 → 确认后创建

读取 `reference/templates.md` 获取完整代码模板，替换 `<placeholder>` 后生成所有文件。

## 目录结构

```
agents/<agent-name>/
├── agent.md            # Agent 配置（YAML frontmatter + Markdown system prompt）
├── lavs.json           # LAVS 清单（endpoints + view + types + permissions）
├── scripts/
│   └── service.cjs     # 统一服务脚本（命令分发模式）
├── view/
│   └── index.html      # 可视化 UI（纯 HTML/CSS/JS）
└── data/
    └── .gitkeep
```

## 关键规则

1. **script handler** — 始终用 `type: "script"`
2. **路径隔离** — 始终用 `process.env.LAVS_PROJECT_PATH` 拼接数据路径
3. **stdout 输出** — 脚本结果必须 `console.log(JSON.stringify(...))`
4. **input 模式** — query 用 `"input": "args"`（process.argv），mutation 用 `"input": "stdin"`（fs.readFileSync(0)）
5. **类型定义** — 在 lavs.json 的 `types` 中声明，支持 Schema 校验
6. **权限声明** — `fileAccess`、`maxExecutionTime` 必须设置
7. **view path** — 写 `"path": "view/index.html"`，不加 `./` 前缀
8. **postMessage 通信** — View 必须用 `window.parent.postMessage({ type: 'lavs-call', ... })` 与父窗口通信

> **⚠️ CSP 踩坑警告**
>
> View 作为 iframe 运行，受 CSP `connect-src 'self'` 约束。**绝对不要**在 View 中直接 `fetch('http://localhost:4936/...')`，否则会被拦截报 "Failed to fetch"。唯一正确方式是 postMessage bridge。

## agent.md 要点

Agent 使用 **Markdown 格式**定义：YAML frontmatter 放配置字段，Markdown body 写 system prompt。

```markdown
---
id: <agent-name>
name: <显示名称>
description: <功能描述>
permissionMode: acceptEdits
allowedTools:
  - { name: Read, enabled: true }
  - { name: Write, enabled: true }
ui:
  icon: 📋
  headerTitle: <显示名称>
---
你是 <agent-name>，一个专注于管理 <领域> 的智能助手...
```

- `allowedTools` 是对象数组格式：`[{ name: Read, enabled: true }, ...]`
- `ui.welcomeMessage` 用 YAML `|` 多行语法
- system prompt 就是 Markdown body（`---` 分隔符之后的内容），不需要放在 frontmatter 里
- 完整模板见 `reference/templates.md`

## lavs.json 要点

- query endpoint: `"input": "args"`
- mutation endpoint: `"input": "stdin"`
- 建议包含 `getDashboard` 聚合 endpoint 供 View 使用
- 完整模板见 `reference/templates.md`

## Handler 脚本要点

使用**单文件命令分发**模式（`service.cjs`），所有 endpoint 共用一个文件：

```javascript
const command = process.argv[2]; // list / add / update / delete / dashboard
switch (command) { ... }
```

- `loadData()` / `saveData()` / `readStdin()` 只写一次
- query 从 `process.argv[3]` 读参数
- mutation 从 `fs.readFileSync(0, 'utf8')` 读 stdin
- 完整模板见 `reference/templates.md`

## View 要点

postMessage bridge 通信核心模式：

```javascript
// 调用 endpoint
function callEndpoint(endpoint, input) {
  return new Promise((resolve, reject) => {
    const id = String(++callId);
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ type: 'lavs-call', id, endpoint, input }, '*');
  });
}

// 接收结果 + AI 操作刷新
window.addEventListener('message', (event) => {
  if (data.type === 'lavs-result') { /* resolve */ }
  if (data.type === 'lavs-error')  { /* reject */ }
  if (data.type === 'lavs-agent-action') { loadData(); }
});
```

- 支持暗色模式：`@media (prefers-color-scheme: dark)`
- UI 布局选型见 `reference/ui-templates.md`（列表/看板/表格/仪表盘）
- 完整模板见 `reference/templates.md`

## 安全清单

- [ ] 脚本只访问 `./data/` 目录
- [ ] JSON Schema 输入校验（schema.input）
- [ ] `maxExecutionTime` 已设置（推荐 5000ms）
- [ ] View 只用 postMessage（无 fetch/XMLHttpRequest）
- [ ] mutation 的 `input` 为 `"stdin"`
- [ ] 脚本无 secret
