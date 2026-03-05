---
name: wecom-integration
description: 为腾讯内部用户配置企业微信群机器人，将 AgentStudio Agent 接入企微群聊。适用场景：配置企微群机器人、接入企微 IM、设置群机器人回调。触发词：企微接入、企业微信、配置企微、wecom、微信机器人、群机器人、接入企微。注意：本技能仅覆盖腾讯内部企微群机器人（依赖 pigeon 中继），其他 IM 平台（Telegram、飞书、Slack 等）请使用对应专项技能。
---

# 腾讯内部企微群机器人接入指南

## 适用范围

**本技能仅适用于腾讯内部企微群机器人**，依赖内部 pigeon 中继服务（`npd-sre.tencent-cloud.com`）。

> 如需接入其他 IM 平台（Telegram、飞书、Slack、Discord），请告知，后续会有对应专项技能覆盖。

## 整体架构

```
企微用户发消息
    │
    ▼
pigeon 中继（腾讯内网）
    │
    ▼
agentstudio.woa.com/callback（nginx → as-dispatch）
    │
    ▼
AgentStudio A2A 端点 → Agent 处理 → 回复用户
```

**服务地址（双路径兼容）：**
- 推荐：`http://agentstudio.woa.com/callback`（nginx 域名）
- 备用：`http://21.6.243.90:8083/callback`（直连 IP）

**前置条件：**
- ✅ 用户已加入腾讯内网，pigeon 中继服务可访问
- ✅ as-dispatch 已在 `agentstudio.woa.com` 部署并正常运行
- ✅ 目标项目已在 AgentStudio 中创建

---

## 执行流程

### 第一步：检查并初始化连接配置

**先调工具查，不要问用户：**

```
mcp__agentstudio-admin__get_tunnel_status
```

根据返回结果判断：

| 情况 | 处理 |
|------|------|
| `server_url` 已配置 且 `enterprise_token_configured: true` | ✅ 直接进入第二步，无需任何配置 |
| `server_url` 已配置 但 `enterprise_token_configured: false` | 告知用户需要提供 as-enterprise Token，然后调用 `configure_tunnel` 补全 |
| `server_url` 未配置（空） | 告知用户需要完成初始化，引导提供 Token |

**需要 Token 时才问用户：**
> 需要你的 as-enterprise Token 来对接企微服务。请登录 `https://agentstudio.woa.com/as/`，在用户设置 → API Token 处获取，粘贴给我即可。

获取 Token 后调用：
```
mcp__agentstudio-admin__configure_tunnel
  server_url:        https://agentstudio.woa.com
  enterprise_token:  <用户提供的 Token>
```

### 第二步：确认目标项目

问：**"你想把哪个项目的 Agent 接入企微？"**

调用 `mcp__agentstudio-admin__list_projects` 列出所有项目，让用户确认。

### 第三步：获取 A2A 端点（自动）

```
mcp__agentstudio-admin__get_a2a_endpoint
  project_path: <用户选择的项目路径>
```

返回：
- `a2aAgentId`：Agent UUID
- `a2aEndpoint`：完整 A2A URL（优先隧道 URL，否则本机 IP）
- `accessMode`：`tunnel` 或 `local`

> ⚠️ **若 `accessMode=local`**：as-dispatch 无法访问到本机服务，需要先创建并连接隧道。**直接执行，不用问用户**：
>
> ```
> mcp__agentstudio-admin__create_tunnel
>   name: <项目名的小写连字符形式，如 my-project>
> ```
>
> 创建成功后会返回 `tunnel_token`，告知用户保存好（后续本地启动 tunely 客户端需要用）。然后重新调用 `get_a2a_endpoint` 获取隧道 URL。

### 第四步：创建 A2A API Key（自动）

```
mcp__agentstudio-admin__create_a2a_api_key
  project_path: <项目路径>
  description:  "企微群机器人 - <项目名>"
```

记录返回的 `key`（格式：`agt_proj_xxxx_yyyy`）。

> ⚠️ 若后续步骤失败需要回滚，调用 `mcp__agentstudio-admin__revoke_a2a_api_key key=<key>` 清理此 Key。

### 第五步：引导用户创建企微机器人

**对用户说：**

> 我已经准备好了 Agent 的连接配置。现在需要你在企微群里做一件事：
>
> 1. 打开企微，进入目标群聊
> 2. 点击右上角 **"..."** → 群设置 → 群机器人 → 添加机器人 → 新创建一个机器人
> 3. 给机器人取个名字（如 "AI 助手"）
> 4. 创建完成后，把机器人的 **Webhook 地址** 发给我：
>    `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxx`

等用户返回 Webhook URL，提取 `key=` 后面的 UUID 作为 `bot_key`。

### 第六步：在 as-dispatch 注册 Bot（自动）

```
mcp__agentstudio-admin__create_wecom_bot
  bot_key:     <从 Webhook URL 提取的 key，即 UUID>
  name:        <项目名>-agent
  target_url:  <第三步的 a2aEndpoint>
  api_key:     <第四步的 key>
  owner_id:    meta-agent
  description: "由 meta-agent 自动创建 - <项目名>"
  timeout:     300
```

确认返回 `{"success": true, ...}`。

> 若返回失败，执行回滚：
> 1. `mcp__agentstudio-admin__revoke_a2a_api_key key=<第四步的key>`
> 2. 告知用户创建失败原因，可重新尝试

### 第七步：生成企微回调配置（自动）

为这个 Bot 生成独立的 Token 和 AES Key（每个 Bot 唯一）：

```bash
TOKEN=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
AESKEY=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9+/' | head -c 43)
echo "Token: $TOKEN"
echo "AES Key: $AESKEY"
```

构造 pigeon 中继 URL：
```
http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=http://agentstudio.woa.com/callback&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json
```

> ⚠️ **pigeon 访问说明**：pigeon 是腾讯内部服务，需要在腾讯内网下访问。如果用户反馈「pigeon URL 无法保存」或「验证失败」，请检查：
> 1. 用户是否在腾讯内网（或 VPN）
> 2. 尝试备用方案：将回调 URL 改为直连 `http://21.6.243.90:8083/callback`，跳过 pigeon 中继

### 第八步：给用户填写回调配置

**对用户说：**

> 请在企微机器人设置里填入接收消息配置：
>
> 1. 群设置 → 群机器人 → 点击刚创建的机器人 → **"接收消息配置"** 标签页
> 2. 填入以下三个字段：
>
> | 字段 | 值 |
> |------|-----|
> | **URL** | `http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=http://agentstudio.woa.com/callback&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json` |
> | **Token** | `<TOKEN>` |
> | **EncodingAESKey** | `<AESKEY>` |
>
> 3. 点击 **保存**

等用户确认保存成功。

### 第九步：验证接入

让用户在群里 @机器人 发一条消息（如 "你好"），确认收到 Agent 的回复。

---

## Bot 日常维护

### 查看 Bot 状态

```
mcp__agentstudio-admin__get_wecom_bot
  bot_key: <bot_key>
```

### 更换绑定的 Agent

如果需要把同一个企微群机器人切换到另一个 Agent：

1. 为新项目创建 A2A API Key（同第四步）
2. 更新 Bot 配置：
```
mcp__agentstudio-admin__update_wecom_bot
  bot_key:    <bot_key>
  target_url: <新的 a2aEndpoint>
  api_key:    <新的 API Key>
```
3. 撤销旧 API Key（可选）：`mcp__agentstudio-admin__revoke_a2a_api_key`

### 下线机器人

as-dispatch 暂无 delete 接口，通过禁用代替：

```
mcp__agentstudio-admin__update_wecom_bot
  bot_key: <bot_key>
  enabled: false
```

同时建议撤销对应的 API Key：`mcp__agentstudio-admin__revoke_a2a_api_key`

### 隧道管理

查看当前隧道连接状态：
```
mcp__agentstudio-admin__get_tunnel_status
```

手动重连隧道：
```
mcp__agentstudio-admin__connect_tunnel
```

---

## 故障排查

### 保存接收消息配置时报错
- URL 字段要完整（企微输入框有时截断长 URL，建议先复制到文本编辑器确认完整性）
- 检查 as-dispatch 状态：`curl http://agentstudio.woa.com/health`（应返回 `{"status":"healthy",...}`）
- 确认在腾讯内网下操作（pigeon 为内部服务）

### 发消息没有回复
- 检查 Bot 配置：`mcp__agentstudio-admin__get_wecom_bot bot_key=<key>`
- 检查 A2A 可达性：`curl <a2aEndpoint>/.well-known/agent-card.json`
- 若 `accessMode=local`，检查隧道状态：`mcp__agentstudio-admin__get_tunnel_status`

### A2A 鉴权失败（401）
- 重新生成 API Key：`mcp__agentstudio-admin__create_a2a_api_key`
- 更新 Bot 配置：`mcp__agentstudio-admin__update_wecom_bot bot_key=<key> api_key=<new-key>`

### enterprise_token 过期
- 重新登录 as-enterprise 获取新 Token
- 重新调用 `mcp__agentstudio-admin__configure_tunnel` 更新 Token

---

## 用户可用的企微命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/reset` | 重置会话，开始新对话 | `/reset` |
| `/sess` | 查看当前会话 ID 和绑定 Agent | `/sess` |
| `/status` | 查看 Bot 运行状态和统计信息 | `/status` |
| `/health` | 检测 Agent A2A 端点连通性 | `/health` |
| `/cp` | 查看当前绑定的 Agent 项目 | `/cp` |
| `/use <项目ID>` | 切换到指定 Agent 项目 | `/use proj_abc123` |
| `/ap <ID> <URL> --api-key <Key>` | 添加个人 Agent 项目（管理员） | `/ap myproj http://... --api-key agt_xxx` |
