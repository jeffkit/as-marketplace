# LAVS Agent 完整代码模板

创建 LAVS Agent 时，从这里复制模板，替换 `<placeholder>` 标记。

---

## agent.md

使用 **YAML frontmatter + Markdown body** 格式。frontmatter 放配置字段，body 写 system prompt。

````markdown
---
id: <agent-name>
name: <显示名称>
description: <功能描述>
version: "1.0.0"
permissionMode: acceptEdits
allowedTools:
  - { name: Read, enabled: true }
  - { name: Write, enabled: true }
  - { name: Edit, enabled: true }
  - { name: Bash, enabled: true }
ui:
  icon: <emoji>
  headerTitle: <显示名称>
  headerDescription: <功能描述>
  welcomeMessage: |
    你好！我是 <显示名称>，你的 <领域> 管理助手。

    你可以这样跟我说：
    - 📋 查看所有 <数据>
    - ➕ 添加新的 <数据条目>
    - ✏️ 更新或删除
author: <作者>
tags:
  - <tag1>
  - <tag2>
enabled: true
---

你是 <agent-name>，一个专注于管理 <领域> 的智能助手。

你拥有 LAVS 工具来操作数据，请始终使用 lavs_ 前缀的工具执行数据操作。

## 能力

- 查询和展示 <数据类型>
- 添加新的 <数据条目>
- 更新和删除现有数据
- 根据用户需求分析和汇总数据

## 行为规范

- 操作数据前先确认用户意图
- 批量操作前告知用户影响范围
- 数据变更后主动告知结果
````

---

## lavs.json

注意：
- **query** endpoint 用 `"input": "args"`
- **mutation** endpoint 用 `"input": "stdin"`
- view path **不加** `./` 前缀

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
        "args": ["scripts/service.cjs", "list"],
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
        "args": ["scripts/service.cjs", "add"],
        "input": "stdin"
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
        "args": ["scripts/service.cjs", "update"],
        "input": "stdin"
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
        "args": ["scripts/service.cjs", "delete"],
        "input": "stdin"
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
    },
    {
      "id": "getDashboard",
      "method": "query",
      "description": "获取仪表盘统计数据",
      "handler": {
        "type": "script",
        "command": "node",
        "args": ["scripts/service.cjs", "dashboard"],
        "input": "args"
      },
      "schema": {
        "output": {
          "type": "object",
          "properties": {
            "total": { "type": "number" },
            "stats": { "type": "object" },
            "recent": { "type": "array" }
          }
        }
      }
    }
  ],
  "view": {
    "component": {
      "type": "local",
      "path": "view/index.html"
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

## scripts/service.cjs

单文件命令分发模式。所有 endpoint 共用，通过 `process.argv[2]` 区分命令。

- **query** 操作：参数通过 `process.argv[3]` 传入（JSON 字符串）
- **mutation** 操作：参数通过 stdin 传入，用 `fs.readFileSync(0, 'utf8')` 读取

```javascript
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ========== 配置 ==========
const projectPath = process.env.LAVS_PROJECT_PATH || '.';
const dataFile = path.join(projectPath, 'data', '<items>.json');

// ========== 数据操作（共用） ==========
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveData(data) {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// ========== 命令处理 ==========
const command = process.argv[2];

switch (command) {
  case 'list': {
    const items = loadData();
    const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
    const result = args.filter
      ? items.filter(item => JSON.stringify(item).toLowerCase().includes(args.filter.toLowerCase()))
      : items;
    console.log(JSON.stringify(result));
    break;
  }

  case 'add': {
    const input = readStdin();
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
    break;
  }

  case 'update': {
    const { id, ...updates } = readStdin();
    const items = loadData();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) {
      console.error(JSON.stringify({ error: 'Not found' }));
      process.exit(1);
    }
    items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
    saveData(items);
    console.log(JSON.stringify(items[idx]));
    break;
  }

  case 'delete': {
    const { id } = readStdin();
    const items = loadData();
    const filtered = items.filter(i => i.id !== id);
    const deleted = items.length !== filtered.length;
    saveData(filtered);
    console.log(JSON.stringify({ success: deleted }));
    break;
  }

  case 'dashboard': {
    const items = loadData();
    const total = items.length;
    const stats = {};
    items.forEach(item => {
      const key = item.status || 'unknown';
      stats[key] = (stats[key] || 0) + 1;
    });
    const recent = items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    console.log(JSON.stringify({ total, stats, recent }));
    break;
  }

  default:
    console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
    process.exit(1);
}
```

---

## view/index.html

View 通过 **postMessage bridge** 与 AgentStudio 通信（不可直接 fetch，否则 CSP 拦截）。

替换标记：`DISPLAY_NAME`、`LIST_ENDPOINT_ID`，自定义 `renderItem()` 函数。
更多 UI 布局参见 `reference/ui-templates.md`。

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
      background: #f8fafc; color: #1e293b; padding: 16px; min-height: 100vh;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .meta { font-size: 12px; color: #94a3b8; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .item {
      background: white; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 12px 16px; transition: box-shadow 0.15s;
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
    let callId = 0;
    const pending = new Map();

    function callEndpoint(endpoint, input) {
      return new Promise((resolve, reject) => {
        const id = String(++callId);
        pending.set(id, { resolve, reject });
        window.parent.postMessage({ type: 'lavs-call', id, endpoint, input }, '*');
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
        loadData();
      }
    });

    function renderItem(item) {
      return `<div class="item">${Object.entries(item).map(([k, v]) =>
        `<span style="margin-right:12px"><b>${k}</b>: ${v}</span>`
      ).join('')}</div>`;
    }

    function render(items) {
      const content = document.getElementById('content');
      document.getElementById('meta').textContent = `${items.length} 条记录`;
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
