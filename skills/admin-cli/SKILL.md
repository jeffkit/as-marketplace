---
name: admin-cli
description: >
  通过 AgentStudio Admin CLI 管理平台资源。替代 MCP 方式，减少约 94% token 消耗。
  Use when an agent needs to manage AgentStudio resources: projects, agents, MCP servers,
  providers, scheduled tasks, skills, rules, commands, hooks, marketplace plugins, A2A,
  tunnels, WeCom bots, or enterprise auth.
  Triggers: "管理 Agent", "创建 Agent", "列出项目", "查看系统状态", "安装插件",
  "manage agents", "create agent", "list projects", "system status", "install plugin".
---

# AgentStudio Admin CLI

通过命令行管理 AgentStudio 平台的所有资源，作为 MCP Admin 的轻量化替代方案。

## 为什么用 CLI 而不是 MCP

- MCP 方式需将 80 个工具的 schema 注入上下文，消耗 **55,000+ tokens**
- CLI 方式只在需要时执行命令，**减少约 94% token 消耗**
- LLM 天然理解 CLI 命令，无需额外 schema 描述

## 前置条件

需要 `AGENTSTUDIO_ADMIN_API_KEY` 环境变量。

如果未设置，告诉用户在 AgentStudio 设置页面 (Settings → MCP Admin) 生成 API Key，
然后设置环境变量：
```bash
export AGENTSTUDIO_ADMIN_API_KEY="ask_xxxxx"
```

## 使用方式

### 第一步：确认连通性

```bash
agentstudio admin ping
```

### 第二步：发现可用工具

```bash
# 列出全部工具（按 15 个类别分组，共 80 个）
agentstudio admin tools

# 查看某个工具的详细参数和用法
agentstudio admin describe <tool-name>
```

### 第三步：执行操作

```bash
# 方式一：--key value 参数（推荐，可读性好）
agentstudio admin call <tool-name> --param1 value1 --param2 value2

# 方式二：JSON 参数（适合复杂参数或脚本调用）
agentstudio admin call <tool-name> '{"param1": "value1"}'

# 方式三：stdin 管道（适合超长参数如 system prompt）
echo '{"systemPrompt": "very long prompt..."}' | agentstudio admin call create-agent --stdin
```

## 常用操作示例

### 管理 Agent

```bash
# 列出所有 Agent
agentstudio admin call list-agents

# 查看某个 Agent 详情
agentstudio admin call get-agent --agent-id jarvis

# 创建新 Agent
agentstudio admin call create-agent \
  --id my-new-agent \
  --name "My New Agent" \
  --description "A specialized agent" \
  --system-prompt "You are a helpful assistant specialized in..."

# 更新 Agent
agentstudio admin call update-agent --agent-id my-agent --max-turns 100

# 删除 Agent
agentstudio admin call delete-agent --agent-id my-agent
```

### 管理项目

```bash
# 列出项目
agentstudio admin call list-projects --limit 20

# 注册新项目
agentstudio admin call register-project --path /absolute/path/to/project --name "My Project"

# 更新项目默认 Agent
agentstudio admin call update-project --path /path/to/project --default-agent jarvis
```

### 查看系统状态

```bash
agentstudio admin call get-system-status
agentstudio admin call health-check
agentstudio admin call get-active-sessions
```

### 管理 Skills / Rules / Commands

```bash
# Skills
agentstudio admin call list-skills
agentstudio admin call create-skill --name "my-skill" --description "..." --content "# SKILL.md content..."
agentstudio admin call delete-skill --skill-id my-skill

# Rules
agentstudio admin call list-rules
agentstudio admin call create-rule --name "my-rule" --content "Rule content..." --always-apply true

# Commands
agentstudio admin call list-commands
agentstudio admin call create-command --name "my-cmd" --content "Command template..."
```

### 管理定时任务

```bash
agentstudio admin call list-scheduled-tasks
agentstudio admin call create-scheduled-task \
  --name "Daily Report" \
  --agent-id jarvis \
  --project-path /path/to/project \
  --schedule-type cron \
  --cron-expression "0 9 * * *" \
  --trigger-message "请生成今日站会报告"
agentstudio admin call run-scheduled-task --task-id <id>
```

### Marketplace 插件

```bash
agentstudio admin call list-marketplace-plugins --marketplace-name default
agentstudio admin call install-plugin --plugin-name my-plugin --marketplace-name default
agentstudio admin call uninstall-plugin --plugin-name my-plugin --marketplace-name default
```

### A2A / Tunnel / WeCom

```bash
# A2A
agentstudio admin call get-a2a-endpoint --project_path /path/to/project
agentstudio admin call create-a2a-api-key --project_path /path --description "For bot"

# Tunnel
agentstudio admin call create-tunnel --name my-tunnel
agentstudio admin call connect-tunnel
agentstudio admin call get-tunnel-status

# WeCom Bot
agentstudio admin call list-wecom-bots
agentstudio admin call create-wecom-bot --bot_key <uuid> --name "Bot" --target_url <url> --api_key <key>
```

## 参数约定

- CLI flag 使用 **kebab-case**：`--agent-id`, `--system-prompt`
- 自动转换为 API 的 **camelCase**：`agentId`, `systemPrompt`
- 数值自动识别：`--limit 10` → `10`（number）
- 布尔值：`--enabled true` 或 `--no-enabled`
- 数组：重复 flag → `--tags dev --tags test` → `["dev", "test"]`

## 批量操作

```bash
# 从 JSON 文件批量执行
agentstudio admin batch --file ops.json

# ops.json 格式:
# [
#   {"tool": "list-agents", "args": {}},
#   {"tool": "get-project", "args": {"path": "/some/path"}}
# ]

# 并行执行
agentstudio admin batch --file ops.json --parallel
```

## 输出说明

所有输出默认 JSON 格式，可直接 pipe 到 `jq` 处理：

```bash
# 获取所有 Agent 的 ID
agentstudio admin call list-agents | jq '.agents[].id'

# 获取系统内存使用
agentstudio admin call get-system-status | jq '.memory'
```

## 工具类别速查（15 类，80 个工具）

| 类别 | 常用工具 |
|---|---|
| Projects | `list-projects`, `get-project`, `register-project`, `update-project` |
| Agents | `list-agents`, `get-agent`, `create-agent`, `update-agent`, `delete-agent` |
| MCP Servers | `list-mcp-servers`, `add-mcp-server`, `remove-mcp-server` |
| System | `get-system-status`, `health-check`, `get-active-sessions` |
| Providers | `list-providers`, `create-provider`, `set-default-provider` |
| Tasks | `list-scheduled-tasks`, `create-scheduled-task`, `run-scheduled-task` |
| Skills | `list-skills`, `create-skill`, `update-skill`, `delete-skill` |
| Rules | `list-rules`, `create-rule`, `update-rule`, `delete-rule` |
| Commands | `list-commands`, `create-command`, `update-command` |
| Hooks | `list-hooks`, `create-hook`, `update-hook` |
| Marketplace | `list-marketplace-plugins`, `install-plugin`, `uninstall-plugin` |
| A2A | `get-a2a-endpoint`, `create-a2a-api-key`, `allow-a2a-call` |
| Tunnel | `create-tunnel`, `connect-tunnel`, `get-tunnel-status` |
| WeCom | `list-wecom-bots`, `create-wecom-bot`, `update-wecom-bot` |
| Enterprise | `login-enterprise`, `check-enterprise-auth` |

用 `agentstudio admin tools` 查看完整列表，或 `agentstudio admin describe <tool>` 查看任意工具的详细参数。

## 错误处理

CLI 在出错时返回 exit code 1，并输出错误信息到 stderr。
常见错误：
- `Admin API key is required` → 设置 AGENTSTUDIO_ADMIN_API_KEY
- `Authentication failed` → API Key 无效或已过期
- `Tool not found` → 工具名拼写错误，用 `agentstudio admin tools` 查看

## 开发模式

在 agentstudio/backend 目录下可直接用 tsx 运行（无需全局安装）：
```bash
cd agentstudio/backend
pnpm admin tools
pnpm admin call list-agents
```
