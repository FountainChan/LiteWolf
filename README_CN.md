# 🐺 LiteWolf

**[English](README.md)** · **[简体中文](README_CN.md)**

**为 [OpenCode](https://opencode.ai) 打造的第二大脑。** 零依赖、零 API 调用、纯文件 I/O。

灵感来自 [OpenWolf](https://github.com/cytostack/openwolf) —— 从 Claude Code hooks 移植到 OpenCode 原生插件系统。

---

## ✨ 它能做什么

LiteWolf 为你的 AI 编程助手提供：

- 📋 **文件索引** —— 在读取文件之前就知道里面有什么
- 🧠 **学习记忆** —— 跨会话记住你的纠正和偏好
- 📊 **Token 统计** —— 估算并记录每次会话的 token 用量
- 🐛 **Bug 记忆** —— 可搜索的 bug 修复记录，防止重复踩坑
- ⚡ **重复读取检测** —— 当同一文件被多次读取时发出警告

全部通过 OpenCode 原生插件事件实现。**不需要 LLM API、不需要外部服务、不需要后台进程。**

---

## 📦 安装

### 方式一：npm 安装（推荐）

在项目的 `opencode.json` 中添加：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["litewolf"]
}
```

或添加到全局配置（`~/.config/opencode/opencode.json`）以对所有项目生效：

```json
{
  "plugin": ["litewolf"]
}
```

OpenCode 启动时通过 Bun 自动安装插件，无需手动操作。

也可以直接通过 npm 安装：

```bash
npm install -g litewolf
```

或在项目中本地安装：

```bash
npm install litewolf
```

### 方式二：复制到全局插件目录

```bash
cp src/index.js ~/.config/opencode/plugins/openwolf.js
```

### 方式三：复制到项目插件目录

```bash
cp src/index.js your-project/.opencode/plugins/openwolf.js
```

### 依赖

需要在 `.opencode/package.json` 中安装 `@opencode-ai/plugin`：

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.1.0"
  }
}
```

安装完成后重启 OpenCode，LiteWolf 会自动在项目中初始化 `.wolf/` 目录。

> 💡 **说明**：npm 包名是 `litewolf`，但插件文件名是 `openwolf.js`。这是有意为之——LiteWolf 这个名字用于与原版 Claude Code 的 OpenWolf 区分，而文件名保持兼容。

---

## 🚀 快速开始

```bash
# 1. 安装插件（选择上面任一方式）

# 2. 在项目中启动 OpenCode —— .wolf/ 目录自动创建

# 3. 生成文件索引
/wolf-scan

# 4. LiteWolf 已激活！正常工作即可。
```

---

## 🗂️ `.wolf/` 目录结构

LiteWolf 在项目根目录创建 `.wolf/` 文件夹：

| 文件 | 用途 |
|------|------|
| `anatomy.md` | 文件索引，包含描述和 token 估算 |
| `cerebrum.md` | 学习记忆：偏好、禁止重复列表、关键发现 |
| `memory.md` | 按时间顺序的操作日志（自动追加） |
| `buglog.json` | Bug 修复记录，可搜索 |
| `token-ledger.json` | 累计 token 统计和会话历史 |
| `config.json` | 插件配置 |
| `identity.md` | 项目名称和 AI 角色定义 |
| `OPENWOLF.md` | 注入到系统提示词的指令 |

---

## 📋 命令

| 命令 | 说明 |
|------|------|
| `/wolf-scan` | 扫描项目并重建 `anatomy.md` 文件索引 |
| `/wolf-learn <内容>` | 将学习或偏好添加到 `cerebrum.md` |

## 🔧 自定义工具：`wolf-bug`

LiteWolf 添加了 `wolf-bug` 工具，AI 可以直接调用：

**搜索 bug：**
```
action: "search"
term: "TypeError"
```

**记录 bug 修复：**
```
action: "log"
term: "Cannot read properties of undefined"
file: "src/components/List.tsx"
root_cause: "API 返回值为 null"
fix: "添加可选链：data?.items?.map()"
tags: "null-check, api, react"
```

---

## 🔄 功能状态

### ✅ 已实现（核心功能）

| 功能 | OpenCode 事件 | 说明 |
|------|--------------|------|
| 📋 **Anatomy 文件索引** | `tool.execute.before` (read) | 读取前显示文件描述 + token 估算；记录命中/未命中 |
| 🧠 **Cerebrum 学习记忆** | `tool.execute.before` (write/edit) | 写入前检查 Do-Not-Repeat 规则；违规时警告 |
| 📊 **Token 统计** | `tool.execute.after` + `session.idle` | 估算每次读写的 token；会话结束时写入统计 |
| 📝 **Anatomy 自动更新** | `tool.execute.after` (write/edit) | 每次写入后更新文件索引并追加操作日志 |
| 🐛 **Buglog 错误记忆** | `wolf-bug` 自定义工具 | 通过 AI 工具调用搜索和记录 bug 修复 |
| ⚡ **重复读取警告** | `tool.execute.before` (read) | 当同一文件在同一会话中被多次读取时警告 |
| 🎯 **系统提示词注入** | `experimental.chat.system.transform` | 将 OPENWOLF.md + anatomy 摘要 + cerebrum 规则 + buglog 注入每次对话 |
| 🔍 **项目扫描** | `/wolf-scan` 命令 | 委托 AI 扫描文件，生成结构化的 anatomy.md |
| 📚 **学习命令** | `/wolf-learn` 命令 | 通过 AI 向 cerebrum.md 添加条目 |
| 🏗️ **自动初始化** | 插件加载时 | 如果 `.wolf/` 不存在则自动创建所有模板文件 |

### ❌ 未实现（高级功能）

以下功能来自原版 OpenWolf，**未包含在 LiteWolf 中**。它们大多需要常驻后台进程或外部依赖：

| 功能 | 未包含的原因 |
|------|------------|
| 👻 **守护进程** | 需要 PM2 或常驻进程；LiteWolf 是事件驱动的，非守护进程模式 |
| 📊 **Web 仪表盘** | 需要 HTTP 服务器 + WebSocket；与 LiteWolf 零依赖理念冲突 |
| 📸 **设计评审（Design QC）** | 需要 `puppeteer-core` + Chrome；对小众功能来说是重依赖 |
| 🎨 **Reframe（UI 框架选择）** | 领域特定知识库；更适合作为独立 skill |
| 👁️ **文件监听** | 需要守护进程模式；LiteWolf 的 hook 是被动的，不是主动的 |
| ⏰ **定时任务** | 需要守护进程模式；定期重扫可通过 `/wolf-scan` 手动完成 |
| 🤖 **AI 反思** | 需要 `claude -p` 子进程；会增加外部模型依赖 |

> 💡 **设计理念**：LiteWolf 故意省略了守护进程相关功能。如果你需要定时任务、仪表盘或截图设计评审，请考虑使用原版 [OpenWolf](https://github.com/cytostack/openwolf) + Claude Code。

---

## 🏗️ 工作原理

```
你输入消息
    ↓
OpenCode 决定读取一个文件
    ↓
LiteWolf (tool.execute.before)：
  "anatomy.md 显示这个文件约 380 tokens。描述：主入口文件。"
  "⚠️ 你已经在本会话中读过这个文件了。"
    ↓
OpenCode 读取文件
    ↓
LiteWolf (tool.execute.after)：估算 token，记录读取
    ↓
OpenCode 写入代码
    ↓
LiteWolf (tool.execute.before)：检查 cerebrum Do-Not-Repeat 规则
    ↓
写入完成
    ↓
LiteWolf (tool.execute.after)：更新 anatomy.md，追加到 memory.md
    ↓
会话结束
    ↓
LiteWolf (session.idle)：将会话摘要写入 token-ledger.json
```

---

## ⚙️ 配置

编辑 `.wolf/config.json` 进行自定义：

```json
{
  "enabled": true,
  "track_tokens": true,
  "warn_repeated_reads": true,
  "enforce_cerebrum": true
}
```

---

## 🆚 对比

| | **LiteWolf** | **OpenWolf** |
|---|---|---|
| **目标平台** | OpenCode | Claude Code |
| **安装方式** | 复制一个文件 或 npm 安装 | `npm install -g openwolf` |
| **依赖** | 零（使用 OpenCode 插件 SDK） | Node.js 20+，可选 PM2/puppeteer |
| **外部 API** | 无 | 无（可选 `claude -p` 用于 AI 任务） |
| **机制** | OpenCode 插件事件 | Claude Code hooks（6 个脚本） |
| **守护进程** | 无 | 有（可选） |
| **仪表盘** | 无 | 有 |
| **设计评审** | 无 | 有（puppeteer） |
| **Token 节省** | ~60-70%（anatomy 命中 + 重复读取拦截） | ~65-80%（同上 + AI 优化） |

---

## 🤝 致谢

- **原始创意**：[OpenWolf](https://github.com/cytostack/openwolf) by [Cytostack](https://github.com/cytostack)
- **OpenCode 插件系统**：[opencode.ai](https://opencode.ai)

---

## 📄 许可证

[AGPL-3.0](LICENSE)
