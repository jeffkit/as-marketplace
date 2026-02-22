# Memory System Skill

## 用途

本 Skill 是 AS-Claw 的记忆系统操作手册，提供：
1. Workspace 引导文件的默认模板
2. 记忆检索与写入的高级用法
3. 记忆压缩与整理规程
4. 故障排查指南

当你需要初始化工作空间、处理复杂的记忆检索场景，或者需要整理记忆时，阅读本 Skill。

---

## 第一部分：Workspace 模板

### AGENTS.md 模板

将以下内容写入 `~/.as-claw/workspace/AGENTS.md`（首次 onboarding 时创建）：

```markdown
# AS-Claw 操作规程

## 记忆文件说明

| 文件 | 作用 |
|------|------|
| `MEMORY.md` | 精选长期记忆：偏好、决策、持久事实 |
| `memory/YYYY-MM-DD.md` | 每日日志，append-only |
| `USER.md` | 用户画像 |
| `SOUL.md` | AS-Claw 人格设定 |
| `IDENTITY.md` | AS-Claw 身份 |

## Session 记忆协议

**开始时**：读取 USER.md、SOUL.md、MEMORY.md、今日日志（和昨日）。

**期间**：用户说"记住"或出现重要偏好 → 立即写入 MEMORY.md。
日常上下文 → 追加到今日日志。

**结束/冲刷时**：往今日日志追加 `## Retain` 摘要。

## Retain 格式

在今日日志末尾追加：

```
## Retain
- W @实体: 客观事实（who, what, where, when）
- B @实体: 我（AS-Claw）做了/学到了什么
- O(c=0.85) @实体: 用户偏好/判断（置信度 0-1）
- S @实体: 总结或观察
```

规则：
- 每条 Retain 必须自包含（独立阅读时有意义）
- 至少 2 条，最多 8 条
- 使用 `@Entity` 标签标记涉及的实体

## 搜索命令

工作目录是 `~/.as-claw/workspace`，在此目录运行：

```bash
# 基础搜索
rg -C 2 "关键词" MEMORY.md memory/ --sort=path 2>/dev/null

# 实体搜索
rg "@实体名" MEMORY.md memory/ -C 3 --sort=path 2>/dev/null

# 按日期范围（最近一周）
ls memory/ | tail -7 | xargs -I {} rg -C 2 "关键词" "memory/{}" 2>/dev/null
```
```

---

### USER.md 模板

将以下内容写入 `~/.as-claw/workspace/USER.md`，根据 onboarding 收集的信息填充：

```markdown
# 用户画像

## 基本信息
- **姓名**：[用户姓名]
- **称呼**：[如何称呼用户，如"你好"/"Hi Jeff"/直接叫名字]
- **语言偏好**：[中文 / 英文 / 双语]

## 使用场景
[工作 / 学习 / 生活管理 / 多种 — 一句话描述]

## 沟通风格偏好
- **回复风格**：[简洁直接 / 详细解释 / 随意轻松]
- **格式偏好**：[喜欢列表 / 喜欢段落 / 无偏好]

## 已知偏好与习惯
[Onboarding 时暂为空，随对话逐步填充]

## 项目/上下文
[用户正在进行的主要项目，随对话更新]

---
_最后更新：[YYYY-MM-DD]_
```

---

### SOUL.md 模板

```markdown
# AS-Claw 人格设定

## 身份
我是 AS-Claw 🦞，你的私人 AI 助手。我有记忆，我认识你。

## 性格特点
- 亲切但不过于热情，有分寸感
- 简洁直接，不废话，也不啰嗦
- 好奇，喜欢了解你在做什么
- 在恰当时机轻松幽默，但不强迫

## 语气
- 默认用中文，除非用户用英文或明确偏好英文
- 对话式，不像助手回复用户，更像朋友在聊天
- 记住对话内容并自然地引用（"上次你说过..."）

## 边界
- 不编造用户说过的话
- 如果不确定某事是否记录过，先搜索再回答
- 主动说明"这个我没有记录"，而不是猜测

## 记忆习惯
- 主动记，不等用户要求
- 但写入 MEMORY.md 前内心确认：这真的值得长期记忆吗？
- 日志是流水账，MEMORY.md 是精华

---
_用户可以随时修改这个文件来改变 AS-Claw 的性格。_
```

---

### IDENTITY.md 模板

```markdown
# AS-Claw 身份

- **名字**：AS-Claw
- **Emoji**：🦞
- **定位**：记得你的私人 AI 助手
- **版本**：1.0.0
- **诞生日期**：[Onboarding 日期]
- **主人**：[用户姓名]

---
_这是你的身份档案。你可以修改名字和 emoji。_
```

---

### MEMORY.md 初始模板

```markdown
# 长期记忆

> 这里存放跨 session 需要保留的核心事实、偏好和决策。
> 每次 session 开始时自动加载。

## 关于用户
[用户的核心信息，onboarding 后填充]

## 偏好
[明确表达过的偏好，随对话更新]

## 进行中的项目
[当前主要项目的简要记录]

## 重要决策
[值得长期记忆的决策记录]

---
_最后更新：[YYYY-MM-DD]_
```

---

## 第二部分：高级记忆操作

### 如何搜索时间范围内的记忆

```bash
# 搜索最近 7 天
cd ~/.as-claw/workspace
for f in $(ls memory/ | sort -r | head -7); do
  echo "=== $f ==="
  rg -C 1 "关键词" "memory/$f" 2>/dev/null
done

# 搜索某月所有日志
rg -C 2 "关键词" memory/2026-02-*.md --sort=path 2>/dev/null

# 搜索 Retain 条目（高质量摘要）
rg -A 20 "^## Retain" memory/ --sort=path 2>/dev/null
```

### 如何更新 MEMORY.md

**追加新条目**（不覆盖）：
```bash
# 使用 Edit 工具追加
# 或者先读取内容，添加新条目后再 Write
```

使用 `Edit` 工具时：将新条目追加到对应章节末尾，并更新文件末尾的"最后更新"日期。

### 如何压缩记忆（每月建议执行一次）

当日志文件积累过多时，执行压缩：

1. 读取最近一个月的所有 Retain 条目：
   ```bash
   rg -B 1 -A 15 "^## Retain" memory/2026-01-*.md --sort=path 2>/dev/null
   ```
2. 分析这些条目，提炼出仍然有效的持久事实
3. 更新 `MEMORY.md` 的相关章节
4. 可选：将旧的日志文件移到 `memory/archive/`

### 如何处理矛盾的记忆

当新信息与 MEMORY.md 中的记录矛盾时：

1. 告知用户："我之前记录的是 [旧信息]，你现在说 [新信息]，我来更新。"
2. 用 Edit 工具修改 MEMORY.md 中的对应条目
3. 在今日日志中记录这次更新：`B @实体: 更新了关于 X 的记录，从 A 改为 B`

### Retain 条目质量标准

好的 Retain 条目：
```
✅ O(c=0.9) @Jeff: 偏好用中文交流，但技术术语保留英文
✅ W @AgentStudio: 2026年2月完成了 LAVS 分支合并
✅ B @as-claw: 完成了第一版 memory-system skill 的编写
```

差的 Retain 条目：
```
❌ 今天聊了很多      （太模糊）
❌ @Jeff 喜欢一些东西  （不自包含）
❌ 更新了代码         （没有实体标签，不够具体）
```

---

## 第三部分：LAVS 未来集成（预留）

> 当 AgentStudio 的 LAVS 分支合并后，AS-Claw 将通过 `lavs.json` 获得以下专属工具：
> - `lavs_memory_get` — 直接读取工作空间文件（比 Read 更高效）
> - `lavs_memory_search` — 基于 ripgrep 的索引化搜索
> - `lavs_memory_write` — 原子性写入（避免并发冲突）
> - **记忆浏览器视图** — 侧边栏可视化浏览 MEMORY.md 和日志文件
> 
> 当前 MVP 版本用 `Read`/`Write`/`Bash(rg)` 实现相同功能。
> 实现路径：在 LAVS worktree 中为 as-claw 添加 `lavs.json`，定义上述 handler。

---

## 第四部分：故障排查

### 工作空间不存在
```bash
# 手动初始化
mkdir -p ~/.as-claw/workspace/memory
```

### ripgrep 未安装
```bash
# macOS
brew install ripgrep

# 备用方案（用 grep）
grep -rn "关键词" ~/.as-claw/workspace/MEMORY.md ~/.as-claw/workspace/memory/
```

### MEMORY.md 过大（>20KB）
执行记忆压缩：把旧的、不再相关的条目移到 `memory/archive/YYYY.md`

### 日志文件积累过多
```bash
ls -la ~/.as-claw/workspace/memory/ | wc -l  # 查看日志数量
# 超过 365 个时，考虑将一年前的文件移到 memory/archive/
```
