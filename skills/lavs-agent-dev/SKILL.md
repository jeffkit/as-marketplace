---
name: lavs-agent-dev
description: 创建符合 LAVS 规范的 AgentStudio Agent，包含数据存储、API endpoints 和可视化 UI。适用于「管理某类数据」、「带看板/仪表盘界面」、「需要 AI + 可视化双界面」等场景。触发关键词：创建 LAVS Agent、带可视化界面的 Agent、lavs.json、数据管理 Agent。
additionalFiles:
  - path: reference/lavs-spec-summary.md
  - path: reference/ui-templates.md
---

# LAVS Agent 开发指南

创建 AgentStudio Agent 并集成 **LAVS (Local Agent View Service)** 能力——让 Agent 同时拥有自然语言对话界面和可视化数据界面。

## 一、何时使用本 Skill

- 用户说「帮我创建一个管理 X 的 Agent」
- 用户想要「带面板/看板/仪表盘」的 Agent
- 用户提到 LAVS、可视化、数据展示
- 任何需要 AI 对话 + 结构化数据展示的场景

## 二、引导式对话流程

### Step 1：需求收集（最多 3 轮问答）

逐步收集以下信息（根据用户描述详细度动态调整问题数量）：

1. **管理什么数据**？（待办事项、笔记、库存、指标、联系人...）
2. **需要哪些操作**？（列表、添加、更新、删除、搜索、筛选...）
3. **是否需要可视化 UI**？（几乎都需要，默认推荐 yes）
4. **项目路径**？（Agent 放在 AgentStudio 的哪个项目下）

### Step 2：展示预览，确认后创建

生成完整目录结构预览，用户确认后再实际创建文件。

---

## 三、目录结构

```
agents/<agent-name>/
├── agent.json          # AgentStudio Agent 配置
├── lavs.json           # LAVS 清单（endpoints、view、permissions）
├── scripts/            # 各 endpoint 的处理脚本
│   ├── list.js
│   ├── add.js
│   ├── update.js
│   └── delete.js
├── view/
│   └── index.html      # 可视化 UI 组件
└── data/               # 数据存储目录
    └── .gitkeep
```

---

## 四、agent.json 模板

```json
{
  "id": "<agent-name>",
  "name": "<显示名称>",
  "description": "<功能描述>",
  "systemPrompt": "你是 <agent-name>，一个专注于管理 <领域> 的智能助手。\n\n你拥有 LAVS 工具来操作数据，请始终使用 lavs_ 前缀的工具执行数据操作。\n\n**能力**：\n- 查询和展示 <数据类型>\n- 添加新的 <数据条目>\n- 更新和删除现有数据\n- 根据用户需求分析和汇总数据\n\n**行为规范**：\n- 操作数据前先确认用户意图\n- 批量操作前告知用户影响范围\n- 数据变更后主动告知结果",
  "model": "claude-sonnet-4-20250514",
  "tools": ["lavs"]
}
```

---

## 五、lavs.json 模板

```json
{
  "lavs": "1.0",
  "name": "<service-name>",
  "version": "1.0.0",
  "description": "<服务描述>",
  "endpoints": [
    {
      "id": "list<Items>",
      "method": "query",
      "description": "获取所有 <数据>",
      "handler": {
        "type": "script",
        "command": "node",
        "args": ["scripts/list.js"],
        "input": "args"
      },
      "schema": {
        "output": {
          "type": "array",
          "items": { "$ref": "#/types/<Item>" }
        }
      }
    },
    {
      "id": "add<Item>",
      "method": "mutation",
      "description": "添加新的 <数据>",
      "handler": {
        "type": "script",
        "command": "node",
        "args": ["scripts/add.js"],
        "input": "args"
      },
      "schema": {
        "input": {
          "type": "object",
          "required": ["<必填字段>"],
          "properties": {
            "<字段名>": { "type": "string", "description": "<字段说明>" }
          }
        },
        "output": { "$ref": "#/types/<Item>" }
      }
    },
    {
      "id": "update<Item>",
      "method": "mutation",
      "description": "更新 <数据>",
      "handler": {
        "type": "script",
        "command": "node",
        "args": ["scripts/update.js"],
        "input": "args"
      },
      "schema": {
        "input": {
          "type": "object",
          "required": ["id"],
          "properties": {
            "id": { "type": "string" }
          }
        },
        "output": { "$ref": "#/types/<Item>" }
      }
    },
    {
      "id": "delete<Item>",
      "method": "mutation",
      "description": "删除 <数据>",
      "handler": {
        "type": "script",
        "command": "node",
        "args": ["scripts/delete.js"],
        "input": "args"
      },
      "schema": {
        "input": {
          "type": "object",
          "required": ["id"],
          "properties": {
            "id": { "type": "string" }
          }
        },
        "output": { "type": "object", "properties": { "success": { "type": "boolean" } } }
      }
    }
  ],
  "view": {
    "component": {
      "type": "local",
      "path": "./view/index.html"
    },
    "fallback": "list"
  },
  "types": {
    "<Item>": {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      }
    }
  },
  "permissions": {
    "fileAccess": ["./data/**/*.json"],
    "networkAccess": false,
    "maxExecutionTime": 5000
  }
}
```

---

## 六、Handler 脚本模板

### scripts/list.js（查询类 - 共用模式）

```javascript
const fs = require('fs');
const path = require('path');

const projectPath = process.env.LAVS_PROJECT_PATH || '.';
const dataFile = path.join(projectPath, 'data', '<items>.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return [];
  }
}

const items = loadData();
// 可在此加过滤/排序逻辑
const args = JSON.parse(process.argv[2] || '{}');
const result = args.filter
  ? items.filter(item => JSON.stringify(item).includes(args.filter))
  : items;

console.log(JSON.stringify(result));
```

### scripts/add.js（新增类 - 共用模式）

```javascript
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const projectPath = process.env.LAVS_PROJECT_PATH || '.';
const dataFile = path.join(projectPath, 'data', '<items>.json');

function loadData() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return []; }
}

function saveData(data) {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const input = JSON.parse(process.argv[2] || '{}');
const items = loadData();
const newItem = {
  id: randomUUID(),
  ...input,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
items.push(newItem);
saveData(items);

console.log(JSON.stringify(newItem));
```

### scripts/update.js

```javascript
const fs = require('fs');
const path = require('path');

const projectPath = process.env.LAVS_PROJECT_PATH || '.';
const dataFile = path.join(projectPath, 'data', '<items>.json');

function loadData() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return []; }
}
function saveData(data) {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const { id, ...updates } = JSON.parse(process.argv[2] || '{}');
const items = loadData();
const idx = items.findIndex(i => i.id === id);
if (idx === -1) { console.error(JSON.stringify({ error: 'Not found' })); process.exit(1); }

items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
saveData(items);
console.log(JSON.stringify(items[idx]));
```

### scripts/delete.js

```javascript
const fs = require('fs');
const path = require('path');

const projectPath = process.env.LAVS_PROJECT_PATH || '.';
const dataFile = path.join(projectPath, 'data', '<items>.json');

function loadData() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return []; }
}
function saveData(data) {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

const { id } = JSON.parse(process.argv[2] || '{}');
const items = loadData();
const filtered = items.filter(i => i.id !== id);
const deleted = items.length !== filtered.length;
saveData(filtered);
console.log(JSON.stringify({ success: deleted, deleted }));
```

---

## 七、View 组件模板

根据数据类型选择不同的 UI 模板（见 `reference/ui-templates.md`），基础模板如下：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DISPLAY_NAME</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 16px;
      min-height: 100vh;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .meta { font-size: 12px; color: #94a3b8; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .item {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      transition: box-shadow 0.15s;
    }
    .item:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .empty { text-align: center; color: #94a3b8; padding: 48px 16px; font-size: 14px; }
    .loading { text-align: center; color: #64748b; padding: 48px; }
    .error { color: #ef4444; text-align: center; padding: 24px; font-size: 13px; }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #e2e8f0; }
      .header { border-color: #1e293b; }
      .item { background: #1e293b; border-color: #334155; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DISPLAY_NAME</h1>
    <span class="meta" id="meta"></span>
  </div>
  <div id="content" class="loading">加载中...</div>

  <script>
    // LAVS 上下文（由 Runtime 注入）
    // const agentId = window.LAVS_AGENT_ID;
    // const projectPath = window.LAVS_PROJECT_PATH;

    let callId = 0;
    const pending = new Map();

    function callEndpoint(endpoint, input) {
      return new Promise((resolve, reject) => {
        const id = String(++callId);
        pending.set(id, { resolve, reject });
        window.parent.postMessage({ type: 'lavs-call', id, endpoint, input }, '*');
        // 超时保护
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 8000);
      });
    }

    window.addEventListener('message', (event) => {
      const { data } = event;
      if (data.type === 'lavs-result' && pending.has(data.id)) {
        pending.get(data.id).resolve(data.result);
        pending.delete(data.id);
      } else if (data.type === 'lavs-error' && pending.has(data.id)) {
        pending.get(data.id).reject(new Error(data.error));
        pending.delete(data.id);
      } else if (data.type === 'lavs-agent-action') {
        // AI 执行了工具调用 → 刷新数据
        loadData();
      }
    });

    function renderItem(item) {
      // 自定义渲染逻辑（根据数据结构调整）
      return `<div class="item">${Object.entries(item).map(([k, v]) =>
        `<span style="margin-right:12px"><b>${k}</b>: ${v}</span>`
      ).join('')}</div>`;
    }

    function render(items) {
      const content = document.getElementById('content');
      const meta = document.getElementById('meta');
      meta.textContent = `${items.length} 条记录`;

      if (items.length === 0) {
        content.innerHTML = '<div class="empty">暂无数据，可以让 AI 帮你添加</div>';
        return;
      }
      content.className = 'list';
      content.innerHTML = items.map(renderItem).join('');
    }

    async function loadData() {
      try {
        const items = await callEndpoint('LIST_ENDPOINT_ID');
        render(items);
      } catch (err) {
        document.getElementById('content').innerHTML =
          `<div class="error">加载失败: ${err.message}</div>`;
      }
    }

    loadData();
  </script>
</body>
</html>
```

替换 `DISPLAY_NAME` 和 `LIST_ENDPOINT_ID`，并自定义 `renderItem()` 函数。

---

## 八、关键规则

1. **始终使用 script handler**（type: 'script'）
2. **始终使用 `process.env.LAVS_PROJECT_PATH`** 做数据路径隔离
3. **结果输出到 stdout**（JSON 格式）
4. **mutation 用 `input: "args"`**，input 作为第一个 CLI 参数传入
5. **在 lavs.json 的 types 中定义类型**——支持 Schema 校验
6. **设置 fileAccess 权限**——即使是声明式也要写
7. **View 组件用纯 HTML/CSS/JS**——无需构建步骤
8. **用 postMessage 通信**——不要在 View 里直接调用 API

---

## 九、安全清单

- [ ] Handler 脚本只访问 `./data/` 目录
- [ ] 通过 JSON Schema 做输入校验（schema.input）
- [ ] 设置 `maxExecutionTime`（推荐 5000ms）
- [ ] View 使用 postMessage（不用 fetch 直接调用）
- [ ] 脚本里不含任何 secret

---

## 十、参考资源

- LAVS 协议完整规范：`platform/lavs/docs/SPEC.md`
- Manifest Schema 校验：`platform/lavs/schema/lavs-manifest.schema.json`
- 示例实现：`agentstudio/.worktrees/lavs/agents/jarvis/`
- UI 模板库：`reference/ui-templates.md`（本 Skill 附件）
