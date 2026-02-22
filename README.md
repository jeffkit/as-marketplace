# AgentStudio 官方插件市场 (as-marketplace)

AgentStudio 平台的官方第一方插件市场，包含系统核心 Agent 和 Skills。

## 包含内容

### Agents

| Agent | 描述 |
|-------|------|
| **Meta Agent** | 系统配置助手 & 业务路由器，通过自然语言管理 AgentStudio 组件 |

### Skills

| Skill | 描述 |
|-------|------|
| **agent-designer** | 引导式 Agent 设计，从需求到配置全流程 |
| **command-designer** | Slash Command 设计引导 |
| **mcp-configurator** | MCP Server 连接配置引导 |
| **mcp-developer** | 从零开发 MCP Server 的完整指南（TypeScript / Python） |
| **task-router** | 业务任务智能路由到合适的 Agent |

## 工作原理

AgentStudio 启动时自动发现并安装此 marketplace：

1. 检查 `BUILTIN_MARKETPLACES` 环境变量（优先）
2. 自动在工作区寻找 `as-marketplace` 目录（开发约定）
3. 将 marketplace 注册为本地类型，安装 plugins 并导入 agents

## 目录结构

```
as-marketplace/
├── .claude-plugin/
│   └── marketplace.json     # 市场清单（agents、skills 定义）
├── agents/
│   └── meta-agent.md        # Meta Agent 配置（YAML frontmatter + 系统提示词）
├── skills/
│   ├── agent-designer/      # Agent 设计技能包
│   ├── command-designer/    # Command 设计技能包
│   ├── mcp-configurator/    # MCP 配置技能包
│   ├── mcp-developer/       # MCP 开发技能包
│   └── task-router/         # 任务路由技能包
├── package.json
└── README.md
```

## 开发

添加新 Agent：
1. 在 `agents/` 目录创建 `<agent-id>.md`（YAML frontmatter + 系统提示词）
2. 在 `.claude-plugin/marketplace.json` 的 `agents` 数组中添加引用

添加新 Skill：
1. 在 `skills/<skill-name>/` 目录创建 `SKILL.md`
2. 在 `.claude-plugin/marketplace.json` 的 `skills` 数组中添加引用
