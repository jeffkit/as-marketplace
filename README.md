# AgentStudio 官方插件市场 (as-marketplace)

AgentStudio 平台的官方第一方插件市场，包含系统核心 Agent 和 Skills。

## 包含内容

### Agents

| Agent | 描述 |
|-------|------|
| **Meta Agent** | 系统配置助手 & 业务路由器，通过自然语言管理 AgentStudio 组件 |
| **AS-Claw** 🦞 | 具有长期记忆的私人 AI 助手，以 Markdown 文件本地持久化偏好与历史上下文（OpenClaw 记忆系统复刻） |
| **Smart Slides** 🎨 | AI 驱动的演讲稿生成与编辑 Agent，支持 Gemini / SeedDream 多引擎 AI 图片渲染（LAVS Agent） |

### Skills

| Skill | 描述 |
|-------|------|
| **agent-designer** | 引导式 Agent 设计，从需求到配置全流程 |
| **command-designer** | Slash Command 设计引导 |
| **mcp-configurator** | MCP Server 连接配置引导 |
| **mcp-developer** | 从零开发 MCP Server 的完整指南（TypeScript / Python） |
| **task-router** | 业务任务智能路由到合适的 Agent |
| **lavs-agent-dev** | LAVS Agent 开发指南 |

## 工作原理

AgentStudio 启动时自动发现并安装此 marketplace：

1. 检查 `BUILTIN_MARKETPLACES` 环境变量（优先）
2. 自动在工作区寻找 `as-marketplace` 目录（开发约定）
3. 将 marketplace 注册为本地类型，安装 plugins 并导入 agents

## 目录结构

```
as-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # 市场清单（agents、skills 定义）
├── agents/
│   ├── meta-agent/               # Meta Agent（带 LAVS 任务队列）
│   │   ├── meta-agent.md
│   │   ├── lavs.json
│   │   └── scripts/
│   ├── as-claw/                  # AS-Claw 记忆 Agent（带 LAVS 记忆浏览器）
│   │   ├── as-claw.md
│   │   ├── lavs.json
│   │   ├── scripts/
│   │   ├── view/
│   │   └── data/
│   └── smart-slides/             # Smart Slides（LAVS Agent，含视图和脚本）
│       ├── smart-slides.md
│       ├── lavs.json
│       ├── scripts/
│       └── view/
├── skills/
│   ├── agent-designer/           # Agent 设计技能包
│   ├── command-designer/         # Command 设计技能包
│   ├── mcp-configurator/         # MCP 配置技能包
│   ├── mcp-developer/            # MCP 开发技能包
│   ├── lavs-agent-dev/           # LAVS Agent 开发指南
│   └── task-router/              # 任务路由技能包
├── package.json
└── README.md
```

## AS-Claw 记忆系统

AS-Claw 是 [OpenClaw](https://openclaw.ai) 记忆机制的 AgentStudio 复刻版，带有完整的 LAVS 集成。

**记忆存储**：`~/.as-claw/workspace/`（Markdown 文件，可 git 备份）

**核心文件**：
- `MEMORY.md` — 精选长期记忆（每次 session 必读）
- `memory/YYYY-MM-DD.md` — 每日追加日志
- `USER.md` / `SOUL.md` / `AGENTS.md` — 用户画像和操作规程

**LAVS 集成**：
- **记忆浏览器视图**：可视化浏览记忆文件、搜索、查看 Retain 摘要
- **Onboarding 向导**：分步引导用户完成初始化
- **自动刷新**：AI 在聊天侧更新记忆后，视图自动感知并刷新
- **LAVS 工具**：`memory_get`/`memory_search`/`memory_write`/`workspace_overview` 等

**记忆检索**：基于 ripgrep，无需外部依赖

## 开发

添加新 Agent：
1. 在 `agents/<agent-id>/` 目录创建 `<agent-id>.md`（YAML frontmatter + 系统提示词）
2. 可选：添加 `lavs.json`（LAVS 清单）、`scripts/`（后端处理）、`view/`（可视化 UI）
3. 在 `.claude-plugin/marketplace.json` 的 `agents` 数组中添加引用

添加新 Skill：
1. 在 `skills/<skill-name>/` 目录创建 `SKILL.md`
2. 在 `.claude-plugin/marketplace.json` 的 `skills` 数组中添加引用
