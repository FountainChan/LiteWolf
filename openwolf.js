/**
 * OpenWolf for OpenCode
 *
 * OpenWolf 的 OpenCode 移植版。自动检测 .wolf/ 目录，
 * 通过 OpenCode plugin events 实现 anatomy 索引、cerebrum 学习记忆、
 * token 统计、buglog 错误记忆。
 *
 * 无需安装 OpenWolf 原版，无需 LLM API，纯文件 I/O。
 */

import fs from "fs";
import path from "path";
import { tool } from "@opencode-ai/plugin";

const WOLF_DIR = ".wolf";
const FILES = {
  anatomy: "anatomy.md",
  cerebrum: "cerebrum.md",
  memory: "memory.md",
  buglog: "buglog.json",
  tokenLedger: "token-ledger.json",
  config: "config.json",
  identity: "identity.md",
  openwolf: "OPENWOLF.md",
};

const CHAR_PER_TOKEN = {
  code: 3.5,
  prose: 4.0,
  mixed: 3.75,
};

function wolfPath(dir, file) {
  return path.join(dir, WOLF_DIR, file);
}

function existsWolfDir(dir) {
  return fs.existsSync(path.join(dir, WOLF_DIR));
}

function initWolfDir(dir) {
  const wp = path.join(dir, WOLF_DIR);
  if (!fs.existsSync(wp)) fs.mkdirSync(wp, { recursive: true });

  const defaults = {
    [FILES.anatomy]:
      "# anatomy.md\n\n> Project structure index. Auto-maintained by openwolf plugin.\n> Status: Pending initial scan\n",
    [FILES.cerebrum]:
      "# cerebrum.md\n\n## Do-Not-Repeat\n\n## User Preferences\n\n## Key Learnings\n\n## Decision Log\n",
    [FILES.memory]:
      "# memory.md\n\n> Chronological action log. Auto-maintained by openwolf plugin.\n",
    [FILES.buglog]: "[]",
    [FILES.tokenLedger]: JSON.stringify(
      {
        lifetime: {
          total_tokens_estimated: 0,
          total_reads: 0,
          total_writes: 0,
          total_sessions: 0,
          anatomy_hits: 0,
          anatomy_misses: 0,
          repeated_reads_warned: 0,
          estimated_savings_vs_bare: 0,
        },
        sessions: [],
      },
      null,
      2,
    ),
    [FILES.config]: JSON.stringify(
      {
        enabled: true,
        track_tokens: true,
        warn_repeated_reads: true,
        enforce_cerebrum: true,
      },
      null,
      2,
    ),
    [FILES.identity]: `# identity.md\n\n- **Project**: ${path.basename(dir)}\n- **Agent Role**: Coding assistant with project memory\n`,
    [FILES.openwolf]: [
      "# OpenWolf Instructions",
      "",
      "You have OpenWolf active. Follow these rules:",
      "",
      "## Before Reading a File",
      "- Check the anatomy hint provided by OpenWolf before deciding to read",
      "- If the anatomy description is sufficient, skip the full read to save tokens",
      "- Never re-read a file in the same session unless explicitly asked",
      "",
      "## Before Writing Code",
      "- Check the cerebrum Do-Not-Repeat warnings",
      "- Respect user preferences listed in cerebrum",
      "- After fixing a bug, log it using the wolf-bug tool",
      "",
      "## Learning",
      "- When the user corrects you or expresses a preference, update cerebrum.md",
      "- Use the wolf-learn tool to add entries to cerebrum",
      "",
      "## Token Awareness",
      "- OpenWolf tracks token usage. Be efficient.",
      "- Use anatomy descriptions instead of full reads when possible.",
    ].join("\n"),
  };

  for (const [file, content] of Object.entries(defaults)) {
    const fp = path.join(wp, file);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, content, "utf8");
    }
  }

  return wp;
}

function safeRead(dir, file) {
  try {
    return fs.readFileSync(wolfPath(dir, file), "utf8");
  } catch {
    return null;
  }
}

function safeWrite(dir, file, content) {
  const fp = wolfPath(dir, file);
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, fp);
}

function safeReadJSON(dir, file) {
  try {
    return JSON.parse(fs.readFileSync(wolfPath(dir, file), "utf8"));
  } catch {
    return null;
  }
}

function estimateTokens(content, ext) {
  if (!content) return 0;
  const isCode = /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|rb|sh|json|yaml|yml|toml|css|html|sql)$/i.test(ext || "");
  const isProse = /\.(md|txt|rst|adoc|org)$/i.test(ext || "");
  const ratio = isCode ? CHAR_PER_TOKEN.code : isProse ? CHAR_PER_TOKEN.prose : CHAR_PER_TOKEN.mixed;
  return Math.ceil(content.length / ratio);
}

function parseAnatomy(content) {
  const entries = {};
  if (!content) return entries;
  const re = /^-\s+`([^`]+)`\s*[–-]\s*(.+?)(?:\s*\(~?(\d+)\s*tok(?:ens?)?\))?$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    entries[m[1]] = {
      description: m[2].trim(),
      tokens: m[3] ? parseInt(m[3], 10) : null,
    };
  }
  return entries;
}

function parseCerebrum(content) {
  const rules = [];
  if (!content) return rules;
  const section = content.match(/##\s*Do-Not-Repeat\s*\n([\s\S]*?)(?=\n##\s|\Z)/);
  if (!section) return rules;
  const lines = section[1].split("\n");
  for (const line of lines) {
    const m = line.match(/^-\s*(.+)$/);
    if (m) rules.push(m[1].trim());
  }
  return rules;
}

function fileExt(filePath) {
  const dot = filePath.lastIndexOf(".");
  return dot >= 0 ? filePath.slice(dot) : "";
}

function relativePath(dir, filePath) {
  const abs = path.resolve(filePath);
  const base = path.resolve(dir);
  if (abs.startsWith(base)) {
    return abs.slice(base.length).replace(/^[\\/]/, "");
  }
  return filePath;
}

function generateDescription(content, relPath) {
  const lines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//"));
  const first = lines[0]?.trim().slice(0, 100) || path.basename(relPath);
  return first;
}

function updateAnatomyEntry(dir, relPath, description, tokens) {
  const content = safeRead(dir, FILES.anatomy);
  if (!content) return;

  const ext = fileExt(relPath);
  const newLine = `- \`${relPath}\` -- ${description} (~${tokens} tok)`;

  const escaped = relPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^-\\s*\`${escaped}\`\\s*[–\\-].+$`, "m");

  let updated;
  if (re.test(content)) {
    updated = content.replace(re, newLine);
  } else {
    const dirPart = path.dirname(relPath);
    const sectionHeader = `## ${dirPart === "." ? "root" : dirPart}/`;
    let sectionIdx = content.indexOf(sectionHeader);
    if (sectionIdx >= 0) {
      const afterHeader = content.indexOf("\n", sectionIdx) + 1;
      updated = content.slice(0, afterHeader) + newLine + "\n" + content.slice(afterHeader);
    } else {
      updated = content.trimEnd() + "\n\n" + sectionHeader + "\n\n" + newLine + "\n";
    }
  }

  safeWrite(dir, FILES.anatomy, updated);
}

function appendMemory(dir, action, relPath, tokens) {
  const content = safeRead(dir, FILES.memory) || "";
  const ts = new Date().toISOString();
  const line = `\n| ${ts} | ${action} | \`${relPath}\` | ~${tokens} tok |`;
  const header = "| Timestamp | Action | File | Tokens |\n|---|---|---|---|";
  if (!content.includes(header)) {
    safeWrite(dir, FILES.memory, content.trimEnd() + "\n\n" + header + "\n" + line.slice(1) + "\n");
  } else {
    safeWrite(dir, FILES.memory, content.trimEnd() + line + "\n");
  }
}

export default async function openwolfPlugin({ client, directory }) {
  if (!existsWolfDir(directory)) {
    initWolfDir(directory);
    console.log("[openwolf] Initialized .wolf/ directory");
  }

  const sessionState = {
    id: `session-${Date.now()}`,
    started: new Date().toISOString(),
    filesRead: {},
    filesWritten: [],
    anatomyHits: 0,
    anatomyMisses: 0,
    repeatedReadsWarned: 0,
    cerebrumWarnings: 0,
    totalTokens: 0,
  };

  return {
    name: "openwolf",

    config: async (inputConfig) => {
      const existing = inputConfig.command || {};
      inputConfig.command = {
        ...existing,
        "wolf-scan": {
          description: "(openwolf) Scan project and rebuild anatomy.md index",
          template: `<command-instruction>
Scan the current project directory structure and rebuild .wolf/anatomy.md.

For each source file, write a one-line description and token estimate in this format:
- \`relative/path\` -- Description (~NNN tok)

Organize by directory sections (## path/).
Skip .wolf/, node_modules/, .git/, dist/, build/ directories.
Use the file list tool and read each file to understand its purpose.
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>`,
        },
        "wolf-learn": {
          description: "(openwolf) Add a learning or preference to cerebrum.md",
          template: `<command-instruction>
Add the following learning/preference to .wolf/cerebrum.md under the appropriate section.

Sections available: Do-Not-Repeat, User Preferences, Key Learnings, Decision Log

Format: - ${new Date().toISOString().slice(0, 10)}: [content]

If the user corrects you, add it to Do-Not-Repeat.
If the user states a preference, add it to User Preferences.
If you discover a project convention, add it to Key Learnings.
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>`,
        },
      };
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const instructions = safeRead(directory, FILES.openwolf);
      if (!instructions) return;

      const anatomy = safeRead(directory, FILES.anatomy);
      const cerebrum = safeRead(directory, FILES.cerebrum);
      const buglog = safeReadJSON(directory, FILES.buglog);

      let context = `<OPENWOLF_CONTEXT>\n${instructions}\n`;

      if (anatomy && anatomy.includes("Pending initial scan")) {
        context += "\n**Note**: anatomy.md has not been scanned yet. Run /wolf-scan to generate the file index.\n";
      } else if (anatomy) {
        const entries = parseAnatomy(anatomy);
        const entryCount = Object.keys(entries).length;
        if (entryCount > 0) {
          context += `\n## Anatomy Summary (${entryCount} files indexed)\n`;
          context += "Use this index to avoid unnecessary file reads.\n\n";
          for (const [fp, info] of Object.entries(entries).slice(0, 60)) {
            context += `- \`${fp}\`: ${info.description}${info.tokens ? ` (~${info.tokens} tok)` : ""}\n`;
          }
          if (entryCount > 60) {
            context += `\n... and ${entryCount - 60} more files. Read anatomy.md for full index.\n`;
          }
        }
      }

      if (cerebrum) {
        const rules = parseCerebrum(cerebrum);
        if (rules.length > 0) {
          context += `\n## Active Do-Not-Repeat Rules\n`;
          for (const rule of rules) {
            context += `- ${rule}\n`;
          }
        }
      }

      if (buglog && Array.isArray(buglog) && buglog.length > 0) {
        context += `\n## Known Bugs (${buglog.length} fixes recorded)\n`;
        for (const bug of buglog.slice(-5)) {
          context += `- [${bug.id}] ${bug.root_cause} → fix: ${bug.fix}\n`;
        }
      }

      context += "\n</OPENWOLF_CONTEXT>";
      (output.system ||= []).push(context);
    },

    "tool.execute.before": async (input, output) => {
      const config = safeReadJSON(directory, FILES.config);
      if (config && config.enabled === false) return;

      if (input.tool === "read") {
        const filePath = output.args?.filePath || input.args?.filePath;
        if (!filePath) return;

        const relPath = relativePath(directory, filePath);
        const anatomy = safeRead(directory, FILES.anatomy);
        const entries = parseAnatomy(anatomy);

        if (relPath in entries) {
          sessionState.anatomyHits++;
          const info = entries[relPath];
          await client.app.log({
            body: {
              service: "openwolf",
              level: "info",
              message: `anatomy: ${relPath} -- ${info.description}${info.tokens ? ` (~${info.tokens} tok)` : ""}`,
            },
          });
        } else {
          sessionState.anatomyMisses++;
        }

        if (config?.warn_repeated_reads !== false && relPath in sessionState.filesRead) {
          sessionState.repeatedReadsWarned++;
          const prev = sessionState.filesRead[relPath];
          await client.app.log({
            body: {
              service: "openwolf",
              level: "warn",
              message: `repeated read: ${relPath} (already read ${prev.count}x, ~${prev.tokens} tok)`,
            },
          });
        }
      }

      if (input.tool === "write" || input.tool === "edit") {
        const filePath = output.args?.filePath || input.args?.filePath;
        const content = output.args?.content || input.args?.content || output.args?.oldString || "";
        if (!filePath || !content) return;

        if (config?.enforce_cerebrum !== false) {
          const cerebrum = safeRead(directory, FILES.cerebrum);
          const rules = parseCerebrum(cerebrum);
          for (const rule of rules) {
            const patterns = rule.match(/["']([^"']+)["']/g) || [];
            const keywords = rule.match(/\b(never|avoid|don'?t|do\s+not)\s+(\S+)/gi) || [];
            for (const p of patterns) {
              const term = p.replace(/["']/g, "");
              if (content.toLowerCase().includes(term.toLowerCase())) {
                sessionState.cerebrumWarnings++;
                await client.app.log({
                  body: {
                    service: "openwolf",
                    level: "warn",
                    message: `cerebrum warning: "${rule}" matched in write to ${relativePath(directory, filePath)}`,
                  },
                });
              }
            }
          }
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const config = safeReadJSON(directory, FILES.config);
      if (config && config.enabled === false) return;

      if (input.tool === "read") {
        const filePath = input.args?.filePath;
        if (!filePath) return;

        const content = typeof output?.result === "string" ? output.result : "";
        const ext = fileExt(filePath);
        const tokens = estimateTokens(content, ext);
        const relPath = relativePath(directory, filePath);

        sessionState.totalTokens += tokens;

        if (relPath in sessionState.filesRead) {
          sessionState.filesRead[relPath].count++;
        } else {
          sessionState.filesRead[relPath] = { count: 1, tokens };
        }
      }

      if (input.tool === "write" || input.tool === "edit") {
        const filePath = input.args?.filePath;
        if (!filePath) return;

        const content = input.args?.content || "";
        const ext = fileExt(filePath);
        const tokens = estimateTokens(content, ext);
        const relPath = relativePath(directory, filePath);

        sessionState.totalTokens += tokens;
        sessionState.filesWritten.push({ file: relPath, tokens, at: new Date().toISOString() });

        const desc = generateDescription(content, relPath);
        updateAnatomyEntry(directory, relPath, desc, tokens);
        appendMemory(directory, input.tool === "edit" ? "edit" : "write", relPath, tokens);
      }
    },

    event: async ({ event }) => {
      if (event.type !== "session.idle") return;

      if (sessionState.totalTokens === 0 && sessionState.filesWritten.length === 0) return;

      const ledger = safeReadJSON(directory, FILES.tokenLedger) || {
        lifetime: {
          total_tokens_estimated: 0,
          total_reads: 0,
          total_writes: 0,
          total_sessions: 0,
          anatomy_hits: 0,
          anatomy_misses: 0,
          repeated_reads_warned: 0,
          estimated_savings_vs_bare: 0,
        },
        sessions: [],
      };

      const readCount = Object.values(sessionState.filesRead).reduce((s, f) => s + f.count, 0);
      const writeCount = sessionState.filesWritten.length;
      const session = {
        id: sessionState.id,
        started: sessionState.started,
        ended: new Date().toISOString(),
        reads: readCount,
        writes: writeCount,
        tokens_estimated: sessionState.totalTokens,
        anatomy_hits: sessionState.anatomyHits,
        anatomy_misses: sessionState.anatomyMisses,
        repeated_reads_warned: sessionState.repeatedReadsWarned,
        cerebrum_warnings: sessionState.cerebrumWarnings,
      };

      ledger.sessions.push(session);

      const lt = ledger.lifetime;
      lt.total_tokens_estimated += sessionState.totalTokens;
      lt.total_reads += readCount;
      lt.total_writes += writeCount;
      lt.total_sessions += 1;
      lt.anatomy_hits += sessionState.anatomyHits;
      lt.anatomy_misses += sessionState.anatomyMisses;
      lt.repeated_reads_warned += sessionState.repeatedReadsWarned;

      const savingsFromAnatomy = sessionState.anatomyHits * 200;
      const savingsFromBlocked = sessionState.repeatedReadsWarned * 300;
      lt.estimated_savings_vs_bare += savingsFromAnatomy + savingsFromBlocked;

      safeWrite(directory, FILES.tokenLedger, JSON.stringify(ledger, null, 2));

      console.log(
        `[openwolf] Session stats: ${readCount} reads, ${writeCount} writes, ~${sessionState.totalTokens} tok, ${sessionState.anatomyHits} anatomy hits, ${sessionState.repeatedReadsWarned} repeated reads warned`,
      );
    },

    tool: {
      "wolf-bug": tool({
        description: "Search or log a bug fix in .wolf/buglog.json. Use action='search' to find bugs by term, action='log' to record a new fix.",
        args: {
          action: tool.schema.string().describe("'search' to find bugs, 'log' to record a new fix"),
          term: tool.schema.string().optional().describe("Search term (for search) or error message (for log)"),
          file: tool.schema.string().optional().describe("File path (for log)"),
          root_cause: tool.schema.string().optional().describe("Root cause (for log)"),
          fix: tool.schema.string().optional().describe("Fix applied (for log)"),
          tags: tool.schema.string().optional().describe("Comma-separated tags (for log)"),
        },
        async execute(args) {
          const bugs = safeReadJSON(directory, FILES.buglog) || [];

          if (args.action === "search") {
            if (!args.term) return "No search term provided.";
            const term = args.term.toLowerCase();
            const results = bugs.filter(
              (b) =>
                (b.error_message || "").toLowerCase().includes(term) ||
                (b.root_cause || "").toLowerCase().includes(term) ||
                (b.fix || "").toLowerCase().includes(term) ||
                (b.tags || []).some((t) => t.toLowerCase().includes(term)),
            );
            if (results.length === 0) return `No bugs found matching "${args.term}".`;
            return results
              .map((b) => `[${b.id}] ${b.error_message}\n  File: ${b.file}\n  Cause: ${b.root_cause}\n  Fix: ${b.fix}\n  Tags: ${(b.tags || []).join(", ")}`)
              .join("\n\n");
          }

          if (args.action === "log") {
            const id = `bug-${String(bugs.length + 1).padStart(3, "0")}`;
            const entry = {
              id,
              error_message: args.term || "",
              file: args.file || "",
              root_cause: args.root_cause || "",
              fix: args.fix || "",
              tags: args.tags ? args.tags.split(",").map((t) => t.trim()) : [],
              logged_at: new Date().toISOString(),
            };
            bugs.push(entry);
            safeWrite(directory, FILES.buglog, JSON.stringify(bugs, null, 2));
            return `Logged ${id}: ${entry.error_message}`;
          }

          return 'Usage: action="search" term="..." or action="log" term="error" file="path" root_cause="..." fix="..."';
        },
      }),
    },
  };
}
