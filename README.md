# 🐺 LiteWolf

**[English](README.md)** · **[简体中文](README_CN.md)**

**A second brain for [OpenCode](https://opencode.ai).** Zero-dependency, zero-API, pure file I/O.

Inspired by [OpenWolf](https://github.com/cytostack/openwolf) — ported from Claude Code hooks to OpenCode's native plugin system.

---

## ✨ What It Does

LiteWolf gives your AI coding assistant:

- 📋 **File Index** — knows what files contain *before* reading them
- 🧠 **Learning Memory** — remembers your corrections and preferences across sessions
- 📊 **Token Tracking** — estimates and logs token usage per session
- 🐛 **Bug Memory** — searchable log of bug fixes to prevent re-discovery
- ⚡ **Repeated Read Detection** — warns when the same file is read multiple times

All through OpenCode's native plugin events. **No LLM API, no external services, no background processes.**

---

## 📦 Installation

### Option 1: From npm (recommended)

Add to your project's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["litewolf"]
}
```

Or add to your global config (`~/.config/opencode/opencode.json`) to enable for all projects:

```json
{
  "plugin": ["litewolf"]
}
```

OpenCode installs the plugin automatically at startup via Bun. No manual steps needed.

You can also install directly via npm:

```bash
npm install -g litewolf
```

Or install locally in your project:

```bash
npm install litewolf
```

### Option 2: From GitHub Release asset (no npm login)

Each release also uploads a tarball to [GitHub Releases](https://github.com/FountainChan/LiteWolf/releases). Install it directly from the URL — no npm account/token needed:

```bash
npm install https://github.com/FountainChan/LiteWolf/releases/download/v1.0.1/litewolf-1.0.1.tar.gz
```

Replace `v1.0.1` in the URL with the latest release version.

### Option 3: Copy to global plugins

```bash
# Download and copy to global plugins directory
cp src/index.js ~/.config/opencode/plugins/openwolf.js
```

### Option 4: Copy to project plugins

```bash
# Download and copy to project plugins directory
cp src/index.js your-project/.opencode/plugins/openwolf.js
```

### Dependencies

Requires `@opencode-ai/plugin` in your `.opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.1.0"
  }
}
```

That's it. Restart OpenCode and run `/wolf-init` in your project to create `.wolf/`.

---

## 🚀 Quick Start

```bash
# 1. Install plugin (one of the options above)

# 2. Start OpenCode in your project, then run /wolf-init to create .wolf/

# 3. Generate the file index
/wolf-scan

# 4. Now LiteWolf is active! Work normally.
```

---

## 🗂️ The `.wolf/` Directory

LiteWolf creates a `.wolf/` folder in your project root:

| File | Purpose |
|------|---------|
| `anatomy.md` | File index with descriptions and token estimates |
| `cerebrum.md` | Learned preferences, Do-Not-Repeat list, key learnings |
| `memory.md` | Chronological action log (auto-appended) |
| `buglog.json` | Bug fix memory, searchable |
| `token-ledger.json` | Lifetime token tracking and session history |
| `config.json` | Plugin configuration |
| `identity.md` | Project name and agent role |
| `OPENWOLF.md` | Instructions injected into system prompt |

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/wolf-init` | Create `.wolf/` with all template files (anatomy, cerebrum, memory, etc.) |
| `/wolf-destroy` | Remove `.wolf/` directory and all its contents (with confirmation) |
| `/wolf-scan` | Scan project and rebuild `anatomy.md` file index |
| `/wolf-learn <text>` | Add a learning or preference to `cerebrum.md` |

## 🔧 Custom Tool: `wolf-bug`

LiteWolf adds a `wolf-bug` tool that the AI can call directly:

**Search bugs:**
```
action: "search"
term: "TypeError"
```

**Log a bug fix:**
```
action: "log"
term: "Cannot read properties of undefined"
file: "src/components/List.tsx"
root_cause: "API response was null"
fix: "Added optional chaining: data?.items?.map()"
tags: "null-check, api, react"
```

---

## 🔄 Feature Status

### ✅ Implemented (Core Features)

| Feature | OpenCode Event | Description |
|---------|---------------|-------------|
| 📋 **Anatomy File Index** | `tool.execute.before` (read) | Shows file description + token estimate before reading; logs anatomy hits/misses |
| 🧠 **Cerebrum Learning Memory** | `tool.execute.before` (write/edit) | Checks Do-Not-Repeat rules before writes; warns on violations |
| 📊 **Token Statistics** | `tool.execute.after` + `session.idle` | Estimates tokens per read/write; writes session summary to ledger |
| 📝 **Anatomy Auto-Update** | `tool.execute.after` (write/edit) | Updates file index and appends to memory log after every write |
| 🐛 **Buglog Error Memory** | `wolf-bug` custom tool | Search and log bug fixes via AI tool calls |
| ⚡ **Repeated Read Warning** | `tool.execute.before` (read) | Warns when the same file is read multiple times in a session |
| 🎯 **System Prompt Injection** | `experimental.chat.system.transform` | Injects OPENWOLF.md + anatomy summary + cerebrum rules + buglog into every conversation |
| 🔍 **Project Scan** | `/wolf-scan` command | Delegates file scanning to AI, generates structured anatomy.md |
| 📚 **Learning Commands** | `/wolf-learn` command | Adds entries to cerebrum.md via AI |
| 🏠 **Explicit Initialization** | `/wolf-init` command | Creates `.wolf/` with all template files on user demand (no auto-creation) |

### ❌ Not Implemented (Advanced Features)

These features from the original OpenWolf are **not included**. They mostly require a persistent background daemon process or external dependencies:

| Feature | Why Not Included |
|---------|-----------------|
| 👻 **Daemon Background Process** | Requires PM2 or persistent process; LiteWolf is event-driven, not daemon-based |
| 📊 **Web Dashboard** | Requires HTTP server + WebSocket; conflicts with LiteWolf's zero-dependency philosophy |
| 📸 **Design QC** | Requires `puppeteer-core` + Chrome; heavy dependency for a niche feature |
| 🎨 **Reframe (UI Framework Selection)** | Domain-specific knowledge base; better as a standalone skill |
| 👁️ **File Watcher** | Requires daemon mode; LiteWolf hooks are reactive, not proactive |
| ⏰ **Cron Scheduled Tasks** | Requires daemon mode; periodic rescans can be done manually via `/wolf-scan` |
| 🤖 **AI Reflections** | Requires `claude -p` subprocess; would add external model dependency |

> 💡 **Philosophy**: LiteWolf deliberately omits daemon-based features. If you need scheduled tasks, dashboards, or screenshot-based design reviews, consider using [OpenWolf](https://github.com/cytostack/openwolf) with Claude Code instead.

---

## 🏗️ How It Works

```
You type a message
    ↓
OpenCode decides to read a file
    ↓
LiteWolf (tool.execute.before):
  "anatomy.md says this file is ~380 tokens. Description: Main entry point."
  "⚠️ You already read this file this session."
    ↓
OpenCode reads the file
    ↓
LiteWolf (tool.execute.after): estimates tokens, records the read
    ↓
OpenCode writes code
    ↓
LiteWolf (tool.execute.before): checks cerebrum Do-Not-Repeat rules
    ↓
Write happens
    ↓
LiteWolf (tool.execute.after): updates anatomy.md, appends to memory.md
    ↓
Session ends
    ↓
LiteWolf (session.idle): writes summary to token-ledger.json
```

---

## ⚙️ Configuration

Edit `.wolf/config.json` to customize:

```json
{
  "enabled": true,
  "track_tokens": true,
  "warn_repeated_reads": true,
  "enforce_cerebrum": true
}
```

---

## 🛠️ Development

### Syncing local source changes to OpenCode

OpenCode does **not** read `~/.config/opencode/package.json` for plugin resolution. Each plugin name in `opencode.json` is resolved to its own cache at `~/.cache/opencode/packages/<name>@latest/`, which by default pulls from npm. So editing source in a local checkout has no effect until the cache is repointed.

To make OpenCode load your local LiteWolf source (e.g. when `npm publish` is unavailable):

1. Repoint OpenCode's litewolf cache to your local checkout. Edit `~/.cache/opencode/packages/litewolf@latest/package.json`:

```json
{
  "dependencies": {
    "litewolf": "file:/absolute/path/to/your/LiteWolf"
  }
}
```

2. Reinstall and verify:

```bash
cd ~/.cache/opencode/packages/litewolf@latest
rm -rf node_modules/litewolf
bun install
```

3. Restart OpenCode. Verify the new code is active by checking the startup log:
   - New behavior: `[openwolf] No .wolf/ directory. Run /wolf-init to activate.`
   - Old behavior (cache not updated): `[openwolf] Initialized .wolf/ directory`

> ⚠️ **`bun install` with `file:` protocol copies files rather than symlinking.** After every edit to `src/index.js`, you must re-run `bun install` for changes to take effect.

> 🧹 **Clean stale cache first** if you previously installed the npm version: `rm -rf ~/.cache/opencode/packages/litewolf ~/.cache/opencode/packages/litewolf@latest/node_modules/litewolf ~/.bun/install/cache/litewolf@*`

### Disabling the plugin entirely

Remove `"litewolf"` from the `plugin` array in `~/.config/opencode/opencode.json`, or start OpenCode with `--pure` to skip all external plugins.

---

## 🆚 Comparison

| | **LiteWolf** | **OpenWolf** |
|---|---|---|
| **Target** | OpenCode | Claude Code |
| **Installation** | Copy one file | `npm install -g openwolf` |
| **Dependencies** | Zero (uses OpenCode plugin SDK) | Node.js 20+, optional PM2/puppeteer |
| **External APIs** | None | None (optional `claude -p` for AI tasks) |
| **Mechanism** | OpenCode plugin events | Claude Code hooks (6 scripts) |
| **Daemon** | No | Yes (optional) |
| **Dashboard** | No | Yes |
| **Design QC** | No | Yes (puppeteer) |
| **Token Savings** | ~60-70% (anatomy hits + repeated read blocking) | ~65-80% (same + AI optimizations) |

---

## 🤝 Credits

- **Original concept**: [OpenWolf](https://github.com/cytostack/openwolf) by [Cytostack](https://github.com/cytostack)
- **OpenCode plugin system**: [opencode.ai](https://opencode.ai)

---

## 📄 License

[AGPL-3.0](LICENSE) — Same as OpenWolf.
