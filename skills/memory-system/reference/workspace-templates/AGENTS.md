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

**期间**：
- 用户说"记住"或出现重要偏好 → 立即写入 MEMORY.md
- 日常上下文 → 追加到今日日志
- 听到实体名 (@人名/@项目名) → 先 rg 搜索相关记忆再回答

**结束/冲刷时**：往今日日志追加 `## Retain` 摘要（2-5 条）。

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
- 每条必须自包含（独立阅读时有意义）
- 至少 2 条，最多 8 条
- 使用 `@Entity` 标签

## 搜索命令

工作目录 `~/.as-claw/workspace`，用 rg：

```bash
rg -C 2 "关键词" MEMORY.md memory/ --sort=path 2>/dev/null
rg "@实体名" MEMORY.md memory/ -C 3 --sort=path 2>/dev/null
```

## 记忆写入原则

写入 MEMORY.md 前问自己：**下次 session 不看日志，这条信息还有用吗？**
- 是 → 写 MEMORY.md
- 否 → 只写今日日志

---
_此文件由 AS-Claw onboarding 自动创建，用户可修改。_
