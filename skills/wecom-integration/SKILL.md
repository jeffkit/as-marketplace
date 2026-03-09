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
as-dispatch /callback 端点
    │
    ▼
AgentStudio A2A 端点 → Agent 处理 → 回复用户
```

## 部署场景说明

企微接入有两种主要部署场景，后续流程依此分支：

| 场景 | 特征 | as-dispatch 回调地址 | A2A 端点来源 |
|------|------|---------------------|-------------|
| **A: 生产/固定 IP 部署** | AgentStudio 部署在服务器上，有固定 IP 或域名；as-dispatch 与 Agent 在同一网络或可达 | 使用已知地址，如 `http://agentstudio.woa.com/callback` 或 `http://<固定IP>:8083/callback` | 用户提供或从已知部署信息推断 |
| **B: 本地开发** | Agent 跑在开发者本机，没有固定外网 IP；as-dispatch 在远端无法直连 | `http://agentstudio.woa.com/callback`（通过隧道中转） | 需要创建 tunely 隧道获取 |

---

## 前置条件

- ✅ 用户已加入腾讯内网，pigeon 中继服务可访问
- ✅ as-dispatch 已部署并正常运行
- ✅ 目标项目已在 AgentStudio 中创建

---

## 执行流程

### 第一步：确定网络连接方式 + as-dispatch 回调地址

**采用「先被动识别 → 再自动探测 → 最后才问用户」的策略，最小化打扰：**

```
步骤 1.1: 被动识别 — 从用户消息提取线索
         │
         ├─ 用户提及了固定 IP / 域名 / "不需要隧道" / "生产环境"
         │   → 直接判定为【场景 A】，跳过 tunnel，进入 1A
         │
         ├─ 用户明确说 "本地开发" / "开发环境"
         │   → 直接判定为【场景 B】，进入 1B
         │
         └─ 无明确线索
             → 进入步骤 1.2: 自动探测

步骤 1.2: 自动探测 — 静默检查 tunnel 状态
         调用 mcp__agentstudio-admin__get_tunnel_status
         │
         ├─ tunnel 已配置且可用（server_url + enterprise_token 均就绪）
         │   → 判定为【场景 B】，进入 1B
         │
         └─ tunnel 未配置 / token 未配置
             → 进入步骤 1.3: 询问用户

步骤 1.3: 仅在此时才询问用户
         "隧道尚未配置。请问你的 AgentStudio 服务是部署在有固定 IP 的服务器上吗？
          - 如果有固定 IP 或域名，请告诉我地址
          - 如果是本地开发，我帮你配置隧道"
         │
         ├─ 用户提供了 IP / 域名 → 【场景 A】，进入 1A
         └─ 用户说本地开发     → 【场景 B】，引导配置 tunnel，进入 1B
```

> ⚠️ **关键原则：如果用户明确表示有固定 IP 或不需要隧道，跳过所有 tunnel 相关操作**（不查 tunnel 状态、不创建 tunnel、不连接 tunnel）。

#### 1A: 场景 A — 确认 as-dispatch 回调地址

不需要操作 tunnel。直接根据用户提供的信息确认 as-dispatch 回调地址：

| 情况 | 回调地址 |
|------|---------|
| 用户有域名（如 `agentstudio.woa.com`） | `http://agentstudio.woa.com/callback` |
| 用户提供了固定 IP（如 `21.6.115.227`） | `http://<IP>:8083/callback` |
| 用户只说了"有固定 IP"但没给具体值 | 询问："as-dispatch 的访问地址是什么？（IP:端口 或 域名）" |

记录此地址为 `DISPATCH_CALLBACK_URL`，后续回调配置要用。

#### 1B: 场景 B — 配置隧道连接

如果 1.2 中 tunnel 已就绪，直接使用，`DISPATCH_CALLBACK_URL = http://agentstudio.woa.com/callback`。

如果 tunnel 未就绪（token 未配置），引导用户提供 Token：
> 需要你的 as-enterprise Token 来对接企微服务。请登录 `https://agentstudio.woa.com/as/`，在用户设置 → API Token 处获取，粘贴给我即可。

获取 Token 后调用：
```
mcp__agentstudio-admin__configure_tunnel
  server_url:        https://agentstudio.woa.com
  enterprise_token:  <用户提供的 Token>
```

场景 B 的 `DISPATCH_CALLBACK_URL` 固定为 `http://agentstudio.woa.com/callback`。

### 第二步：确认目标项目

**先判断用户意图，再决定如何获取项目路径：**

| 用户表达 | 项目路径来源 |
|---------|------------|
| "把当前这个 Agent 接入" / "把你自己接入" / "把这个 Agent 接入" | 使用当前工作目录（`cwd`），即 Agent 启动时所在的目录 |
| 明确说了项目名或路径 | 直接使用，或调用 `list_projects` 匹配 |
| 未指明 | 调用 `list_projects` 列出所有项目让用户选择 |

> **Claude Code 说明**：在 Claude Code 中，**项目目录 = 工作目录**。Agent 的 `workingDirectory`（即 `cwd`）就是当前项目的根目录。如果用户要接入的是"当前 Agent 自己"，直接用 `cwd` 作为 `project_path`，不要调用 `list_projects`。

获取当前工作目录（如需确认）：
```
Bash: pwd
```

### 第三步：获取 A2A 端点

```
mcp__agentstudio-admin__get_a2a_endpoint
  project_path: <用户选择的项目路径>
```

返回：
- `a2aAgentId`：Agent UUID
- `a2aEndpoint`：完整 A2A URL（优先隧道 URL，否则本机 IP）
- `accessMode`：`tunnel` 或 `local`

**⚠️ 对返回的 `a2aEndpoint` 进行校验：**

| 情况 | 处理 |
|------|------|
| URL 包含 Docker 内部 IP（`172.x.x.x`、`10.x.x.x` 等私有网段） | **不可用！** 这是容器内部地址，as-dispatch 无法访问。见下方处理方式 |
| URL 包含 `localhost` 或 `127.0.0.1` | **不可用！** 仅限本机访问 |
| URL 包含隧道域名或可达的公网/内网 IP | ✅ 可直接使用 |

**Docker 内部 IP 或 localhost 的处理**：

- **场景 A（固定 IP）**：将 `a2aEndpoint` 中的 host 替换为用户提供的固定 IP，保留端口和路径。例如：
  - 返回 `http://172.17.0.2:4936/a2a/xxx` → 替换为 `http://21.6.115.227:4936/a2a/xxx`
  - 如果不确定端口映射，询问用户："AgentStudio 的 A2A 服务端口（默认 4936）是否已映射到宿主机？"
- **场景 B（本地开发）**：需要创建 tunely 隧道，**直接执行**：
  ```
  mcp__agentstudio-admin__create_tunnel
    name: <项目名的小写连字符形式，如 my-project>
  ```
  创建成功后会返回 `tunnel_token`，告知用户保存好（后续本地启动 tunely 客户端需要用）。然后重新调用 `get_a2a_endpoint` 获取隧道 URL。

将最终可用的 A2A URL 记为 `A2A_ENDPOINT`。

### 第四步：创建 A2A API Key（自动）

```
mcp__agentstudio-admin__create_a2a_api_key
  project_path: <项目路径>
  description:  "企微群机器人 - <项目名>"
```

记录返回的 `key`（格式：`agt_proj_xxxx_yyyy`）。

> ⚠️ 若后续步骤失败需要回滚，调用 `mcp__agentstudio-admin__revoke_a2a_api_key key=<key>` 清理此 Key。

> ⚠️ **常见错误**：若提示 `.a2a` 目录不存在（如 `/home/agentstudio/xxx/.a2a`），说明项目路径下缺少必要的目录结构。请先创建目录：`mkdir -p <项目路径>/.a2a`，然后重试。

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
  target_url:  <A2A_ENDPOINT>
  api_key:     <第四步的 key>
  owner_id:    meta-agent
  description: "由 meta-agent 自动创建 - <项目名>"
  timeout:     300
```

确认返回 `{"success": true, ...}`。

> ⚠️ **TLS 证书错误**（`ERR_TLS_CERT_ALTNAME_INVALID`）：说明 as-dispatch 的 HTTPS 证书与访问域名不匹配。解决方式：
> - 检查 `create_wecom_bot` 调用时的 `target_url` 是否使用了正确的协议（通常应为 `http://` 而非 `https://`）
> - 如果是域名访问，确认 nginx 证书配置正确
> - 向用户说明情况，让用户检查服务端 TLS 配置

> 若返回失败，执行回滚：
> 1. `mcp__agentstudio-admin__revoke_a2a_api_key key=<第四步的key>`
> 2. 告知用户创建失败原因，可重新尝试

### 第七步：生成企微回调配置（自动）

为这个 Bot 生成独立的 Token 和 AES Key（每个 Bot 唯一）：

```bash
TOKEN=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
AESKEY=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 43)
echo "Token: $TOKEN"
echo "AES Key: $AESKEY"
```

**根据第一步确定的 `DISPATCH_CALLBACK_URL` 构造 pigeon 中继 URL：**

```
http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=<DISPATCH_CALLBACK_URL>&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json
```

**各场景的完整回调 URL 示例：**

| 场景 | DISPATCH_CALLBACK_URL | 完整 pigeon URL |
|------|----------------------|----------------|
| **域名部署**（推荐） | `http://agentstudio.woa.com/callback` | `http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=http://agentstudio.woa.com/callback&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json` |
| **固定 IP 部署** | `http://21.6.115.227:8083/callback` | `http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=http://21.6.115.227:8083/callback&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json` |
| **本地开发（隧道）** | `http://agentstudio.woa.com/callback` | `http://npd-sre.tencent-cloud.com/pigeon/relay/wecom/bot?url=http://agentstudio.woa.com/callback&env=devcloud&token=<TOKEN>&aeskey=<AESKEY>&robot_callback_format=json` |

> ⚠️ **关键注意事项**：
> - pigeon URL 的 `url=` 参数值必须是 **as-dispatch 的 /callback 端点**，不是 A2A 端点
> - 使用用户的固定 IP 时，确认端口 8083 是 as-dispatch 的端口（不是 AgentStudio 的 4936）
> - `url=` 参数中的地址必须是 pigeon 中继服务能访问到的地址（腾讯内网可达）
> - 使用 `http://` 协议（as-dispatch callback 端点通常不需要 HTTPS）

> ⚠️ **pigeon 访问说明**：pigeon 是腾讯内部服务，需要在腾讯内网下访问。如果用户反馈「pigeon URL 无法保存」或「验证失败」，请检查：
> 1. 用户是否在腾讯内网（或 VPN）
> 2. 尝试备用方案：将 `url=` 参数改为直连 IP（如 `http://21.6.243.90:8083/callback`）

### 第八步：给用户填写回调配置

**对用户说：**

> 请在企微机器人设置里填入接收消息配置：
>
> 1. 群设置 → 群机器人 → 点击刚创建的机器人 → **"接收消息配置"** 标签页
> 2. 填入以下三个字段：
>
> | 字段 | 值 |
> |------|-----|
> | **URL** | `<第七步构造的完整 pigeon URL>` |
> | **Token** | `<TOKEN>` |
> | **EncodingAESKey** | `<AESKEY>` |
>
> 3. 点击 **保存**
>
> ⚠️ URL 较长，建议先复制到文本编辑器确认完整性，企微输入框有时会截断长 URL。

等用户确认保存成功。

### 第九步：验证接入

让用户在群里 @机器人 发一条消息（如 "你好"），确认收到 Agent 的回复。

如果没有回复，参考下方「故障排查」章节逐步排查。

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
  target_url: <新的 A2A_ENDPOINT>
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

### 隧道管理（仅场景 B）

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
- 检查 pigeon URL 中 `url=` 参数是否指向了正确的 as-dispatch 回调地址

### A2A 端点返回 Docker 内部 IP
- `get_a2a_endpoint` 返回的 IP 若为 `172.x.x.x`、`10.x.x.x` 等，说明 Agent 运行在 Docker 容器内
- 场景 A：将 host 替换为用户提供的宿主机固定 IP，保持端口和路径
- 场景 B：通过创建 tunely 隧道获取可达 URL

### TLS 证书错误（ERR_TLS_CERT_ALTNAME_INVALID）
- 常见于 `create_wecom_bot` 调用时。通常是 `target_url` 使用了 `https://` 协议，但证书不匹配
- 解决：确认 `target_url`（A2A 端点）使用 `http://` 协议，或让用户修复服务端 TLS 配置

### .a2a 目录不存在
- `create_a2a_api_key` 可能因为项目路径下缺少 `.a2a` 目录而失败
- 解决：`mkdir -p <项目路径>/.a2a`，然后重试

### 发消息没有回复
- 检查 Bot 配置：`mcp__agentstudio-admin__get_wecom_bot bot_key=<key>`
- 检查 A2A 可达性：`curl <A2A_ENDPOINT>/.well-known/agent-card.json`
- 若场景 B，检查隧道状态：`mcp__agentstudio-admin__get_tunnel_status`
- 确认 pigeon URL 中的回调地址与 as-dispatch 实际监听地址一致

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
