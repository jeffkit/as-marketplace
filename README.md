# AgentStudio 官方插件市场 (as-marketplace)

AgentStudio 平台的官方第一方插件市场，包含系统核心 Agent 和 Skills。

## 包含内容

### Agents

| Agent | 描述 |
|-------|------|
| **Meta Agent** | 系统配置助手 & 业务路由器，通过自然语言管理 AgentStudio 组件 |
| **AS-Claw** 🦞 | 具有长期记忆的私人 AI 助手，以 Markdown 文件本地持久化偏好与历史上下文（OpenClaw 记忆系统复刻） |

### Skills

| Skill | 描述 |
|-------|------|
| **agent-designer** | 引导式 Agent 设计，从需求到配置全流程 |
| **command-designer** | Slash Command 设计引导 |
| **mcp-configurator** | MCP Server 连接配置引导 |
| **mcp-developer** | 从零开发 MCP Server 的完整指南（TypeScript / Python） |
| **task-router** | 业务任务智能路由到合适的 Agent |
| **memory-system** | AS-Claw 记忆系统操作手册：workspace 模板、高级检索、记忆压缩 |

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
│   ├── meta-agent.md             # Meta Agent 配置
│   └── as-claw.md                # AS-Claw 记忆 Agent 配置
├── skills/
│   ├── agent-designer/           # Agent 设计技能包
│   ├── command-designer/         # Command 设计技能包
│   ├── mcp-configurator/         # MCP 配置技能包
│   ├── mcp-developer/            # MCP 开发技能包
│   ├── task-router/              # 任务路由技能包
│   └── memory-system/            # AS-Claw 记忆系统技能包
│       ├── SKILL.md
│       └── reference/
│           └── workspace-templates/   # Workspace 引导文件模板
│               ├── AGENTS.md
│               ├── SOUL.md
│               ├── USER.md
│               ├── IDENTITY.md
│               └── MEMORY.md
├── package.json
└── README.md
```

## AS-Claw 记忆系统

AS-Claw 是 [OpenClaw](https://openclaw.ai) 记忆机制的 AgentStudio 复刻版。

**记忆存储**：`~/.as-claw/workspace/`（Markdown 文件，可 git 备份）

**核心文件**：
- `MEMORY.md` — 精选长期记忆（每次 session 必读）
- `memory/YYYY-MM-DD.md` — 每日追加日志
- `USER.md` / `SOUL.md` / `AGENTS.md` — 用户画像和操作规程

**记忆检索**：基于 ripgrep，无需外部依赖

**未来计划**：当 LAVS 分支合并后，为 AS-Claw 添加 `lavs.json`，提供专属 `memory_get`/`memory_search` 工具和记忆浏览器视图。

## 开发

添加新 Agent：
1. 在 `agents/` 目录创建 `<agent-id>.md`（YAML frontmatter + 系统提示词）
2. 在 `.claude-plugin/marketplace.json` 的 `agents` 数组中添加引用

添加新 Skill：
1. 在 `skills/<skill-name>/` 目录创建 `SKILL.md`
2. 在 `.claude-plugin/marketplace.json` 的 `skills` 数组中添加引用
