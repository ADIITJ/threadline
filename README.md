<div align="center">

<br />

<img src="skills/threadline/assets/icon.svg" width="80" alt="Threadline" />

<h1>Threadline</h1>

<p>Work memory for AI agents. Fully passive. Entirely local.</p>

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6366f1?style=flat-square" alt="MIT License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-20%2B-43853d?style=flat-square&logo=node.js&logoColor=white" alt="Node 20+" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/typescript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-20_tools-7c3aed?style=flat-square" alt="20 MCP Tools" /></a>
  <a href="tests/"><img src="https://img.shields.io/badge/tests-58_passing-22c55e?style=flat-square" alt="58 Tests" /></a>
  <img src="https://img.shields.io/badge/cloud-zero-ef4444?style=flat-square" alt="Zero Cloud" />
</p>

<p>
  <a href="examples/.mcp.json">Claude Code</a> ·
  <a href="examples/claude_desktop_config.json">Claude Desktop</a> ·
  <a href="examples/cursor.mcp.json">Cursor</a> ·
  <a href="examples/.vscode/mcp.json">VS Code</a> ·
  <a href="examples/codex.config.toml">Codex</a>
</p>

</div>

---

Threadline watches your filesystem, git, clipboard, browser tabs, and Claude sessions in the background. It clusters events into **threads** — coherent work sessions grouped by project — and exposes everything through 20 MCP tools. Open a new Claude session and your AI already knows what you were doing.

**No prompts. No "remember this." No re-explaining.**

---

## Demo

```
$ # New session. No context pasted.

resume_last_thread()

  ╔══════════════════════════════════════════════════════════════╗
  ║  fix oauth callback in api repo                             ║
  ║  State: active  ·  Last active: 2h ago  ·  8 events        ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  Recent activity                                            ║
  ║  ├─ committed  fix: validate redirect URI before exchange   ║
  ║  ├─ modified   src/auth/callback.ts                         ║
  ║  ├─ visited    https://oauth.net/2/pkce                     ║
  ║  └─ modified   tests/auth.test.ts                           ║
  ║                                                             ║
  ║  Open commitments                                           ║
  ║  ├─ [ ] Add integration test for the callback handler       ║
  ║  └─ [ ] Ping Jake once auth PR is merged                    ║
  ║                                                             ║
  ║  Key artifacts                                              ║
  ║  ├─ src/auth/callback.ts                                    ║
  ║  └─ https://oauth.net/2/pkce                                ║
  ╚══════════════════════════════════════════════════════════════╝
```

```
$ # Three days later. Different machine.

search_threads("oauth")
prepare_handoff(threadId)

  ## Handoff: fix oauth callback in api repo

  Implemented PKCE flow for the OAuth callback handler.
  Redirect URI validation is in place. Integration test is still
  outstanding — see open commitments.

  Timeline
  ├─ [Mar 17 · 14:02]  git/commit — fix: validate redirect URI
  ├─ [Mar 17 · 13:44]  file/modify — src/auth/callback.ts
  └─ [Mar 17 · 11:20]  browser/tab — oauth.net/2/pkce
```

---

## Features

- **Passive capture** — Filesystem, git, clipboard, active window, browser history, Claude Code sessions, Beads memory, and task/plan files. Zero manual input.
- **20 MCP tools** — Resume, search, handoff, checkpoint, cleanup, split, merge, export, import. All in tool-only mode; no resources or prompts required.
- **Commitment extraction** — 13 regex patterns + NLP date parsing. Commitments auto-close when a matching git commit lands.
- **Proactive alerts** — The `health` tool surfaces due-today commitments. The scheduler warns hourly about overdue items.
- **Reversible cleanup** — `safe_clean_downloads` moves files to quarantine with a full manifest. `undo_last_cleanup` restores them.
- **Thread management** — Split threads that grew too broad, merge related threads, export/import for team sharing or backup.
- **Secret redaction** — API keys, Bearer tokens, and high-entropy strings are replaced with `[REDACTED_TOKEN]` before storage.
- **Web UI** — A status dashboard at `http://127.0.0.1:47821/ui`. No build step.
- **Zero cloud** — Everything stays on your machine. Audit log at `~/.threadline/audit/events.jsonl`.

---

## Quick Start

**Requirements:** Node.js 20+, pnpm 8+

```bash
git clone https://github.com/ADIITJ/threadline.git
cd threadline
pnpm install && pnpm build
```

```bash
# Auto-detect and configure your host
node apps/installer/dist/cli.js install --host auto

# Or target a specific host
node apps/installer/dist/cli.js install --host claude-code
node apps/installer/dist/cli.js install --host cursor
node apps/installer/dist/cli.js install --host vscode
node apps/installer/dist/cli.js install --host codex

# Print config without writing (for manual setup)
node apps/installer/dist/cli.js install --host claude-code --print

# Generate a setup prompt to paste into Claude / Codex / Copilot
node apps/installer/dist/cli.js prompt --host claude-code
```

```bash
node apps/installer/dist/cli.js doctor
```

```
Server binary   apps/mcp-server/dist/main.js   ✓  found
Daemon port     47821                           ✓  free
Home dir        ~/.threadline                   ✓  ready
```

**One-liner (macOS / Linux)**

```bash
chmod +x scripts/install-local.sh && ./scripts/install-local.sh
```

```powershell
# Windows
.\scripts\install-local.ps1
```

---

## How It Works

```
  Signal sources               Engine pipeline               Output

  Filesystem ──┐
  Git          │    ┌──────────────────────────────┐    Threads
  Clipboard    ├───▶│ 1. Episode segmentation       │    grouped by project
  Active win   │    │    30-min gap = new episode   │
  Browser      │    │                               │    Commitments
  history      │    │ 2. Signature extraction       │    with due dates
  Claude       │    │    file paths · repo names    │
  sessions     │    │    URL hostnames · free text  │    Artifacts
  Beads        │    │                               │    files & URLs
  Tasks/plans ─┘    │ 3. Jaccard clustering         │
                    │    overlap vs open threads    │
                    └──────────────────────────────┘
```

**Episode segmentation** — A gap of ≥ 30 minutes creates an episode boundary. Events within the gap are preserved as continuity.

**Signature extraction** — Each episode becomes a token set from file paths, repo names, URL hostnames, and free text. Stop words and single-char tokens are filtered.

**Jaccard clustering** — New episodes are scored against open thread signatures. Best match above threshold → merged. No match → new thread. Thread state (active / stale / archived) is re-evaluated every 15 minutes.

---

## MCP Tools

<details open>
<summary><strong>Context & Resumption</strong></summary>

| Tool | Description |
|------|-------------|
| `resume_last_thread` | Resume card for the most recently active thread — events, artifacts, open commitments |
| `get_thread_details` | Full detail view for a thread by ID |
| `get_thread_timeline` | Chronological event list for a thread |
| `explain_why_open` | Explain why a file or URL is associated with current work |

</details>

<details>
<summary><strong>Discovery & Search</strong></summary>

| Tool | Description |
|------|-------------|
| `list_recent_threads` | All threads sorted by last activity, with optional state filter |
| `search_threads` | Full-text search across thread titles, summaries, and events |
| `search_events` | Filter raw events by source, kind, thread, date range, or text query |
| `find_commitments` | Surface open or completed commitments, optionally filtered by thread |
| `list_projects` | Group threads by project with thread counts and open commitment totals |

</details>

<details>
<summary><strong>Thread Management</strong></summary>

| Tool | Description |
|------|-------------|
| `split_thread` | Move selected events from a thread into a new standalone thread |
| `merge_threads` | Merge a source thread into a target — reassigns events, artifacts, commitments |
| `export_thread` | Serialize a thread to portable JSON for backup or sharing |
| `import_thread` | Import an exported thread JSON, remapping all IDs to avoid conflicts |

</details>

<details>
<summary><strong>Actions</strong></summary>

| Tool | Description |
|------|-------------|
| `capture_checkpoint` | Save a manual checkpoint — notes parsed for commitments and due dates |
| `prepare_handoff` | Generate a structured handoff document for a thread |
| `open_thread_artifacts` | Open thread files and URLs in default system apps |
| `archive_thread` | Mark a thread as archived |

</details>

<details>
<summary><strong>Cleanup & Health</strong></summary>

| Tool | Description |
|------|-------------|
| `safe_clean_downloads` | Preview or execute Downloads cleanup — dry-run by default, all moves reversible |
| `undo_last_cleanup` | Restore the most recent cleanup to original paths |
| `health` | Daemon status, per-collector stats, due-today commitment alerts, schema version |

</details>

---

## Configuration

Created at `~/.threadline/config.json` on first run. All fields are optional.

```json
{
  "homeDir": "~/.threadline",
  "daemonPort": 47821,
  "allowPaths": ["~/Desktop", "~/Downloads", "~/Documents"],
  "downloadCleanupThreshold": 3,
  "ignorePrivateBrowser": true,
  "maxStoredClipboardChars": 2000,
  "logLevel": "info"
}
```

<details>
<summary>All configuration keys</summary>

| Key | Default | Description |
|-----|---------|-------------|
| `allowPaths` | Desktop, Downloads, Documents | Paths watched by the filesystem collector |
| `daemonPort` | `47821` | Local HTTP port for the daemon and browser extension |
| `downloadCleanupThreshold` | `3` | Age in days before a file is a cleanup candidate |
| `ignorePrivateBrowser` | `true` | Discard events from incognito/private sessions |
| `maxStoredClipboardChars` | `2000` | Clipboard text is truncated and redacted at this limit |
| `logLevel` | `"info"` | `"debug"` · `"info"` · `"warn"` · `"error"` |
| `enableBrowserHistoryWatcher` | `true` | Read browser history databases (Chrome / Brave / Firefox / Safari) |
| `enableClaudeSessionWatcher` | `true` | Watch `~/.claude/projects/**/*.jsonl` for Claude Code session context |
| `enableBeadsMemoryWatcher` | `true` | Watch `~/.claude/projects/*/memory/*.md` for Beads memory changes |
| `enableClaudeTaskWatcher` | `true` | Poll `~/.claude/todos/` and `~/.claude/plans/` every 30s |
| `enableBrowserIngest` | `true` | Accept real-time tab events from the browser extension |

</details>

### Host configuration

<details>
<summary>Claude Code — <code>~/.claude/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "threadline": {
      "command": "node",
      "args": ["/path/to/threadline/apps/mcp-server/dist/main.js"]
    }
  }
}
```

</details>

<details>
<summary>Claude Desktop — <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "threadline": {
      "command": "node",
      "args": ["/path/to/threadline/apps/mcp-server/dist/main.js"]
    }
  }
}
```

</details>

<details>
<summary>Cursor — <code>.cursor/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "threadline": {
      "command": "node",
      "args": ["/path/to/threadline/apps/mcp-server/dist/main.js"]
    }
  }
}
```

</details>

<details>
<summary>VS Code / GitHub Copilot — <code>.vscode/mcp.json</code></summary>

```json
{
  "servers": {
    "threadline": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/threadline/apps/mcp-server/dist/main.js"]
    }
  }
}
```

</details>

<details>
<summary>Codex — <code>codex.config.toml</code></summary>

```toml
[mcp_servers.threadline]
command = "node"
args = ["/path/to/threadline/apps/mcp-server/dist/main.js"]
```

</details>

---

## Browser Extension

The Chrome MV3 extension streams real-time tab events to the daemon. A Chrome Alarms keep-alive fires every 24 seconds so the service worker never goes idle.

**Permissions:** `tabs` · `storage` · `alarms`
**Host permissions:** `http://127.0.0.1/*` only — no external connections

```bash
pnpm build
# chrome://extensions → Enable developer mode → Load unpacked → apps/browser-extension/dist/
```

---

## Privacy

| Stored | Never stored |
|--------|-------------|
| File paths and modification timestamps | File contents |
| Git branch names and commit metadata | Browser page HTML |
| Browser tab URL and title | Keystrokes |
| Clipboard text (truncated, redacted) | Screen recordings |
| Manual checkpoint notes | Passwords or credentials |

**Secret redaction** — `sk-`, `ghp_`, `AKIA...`, Bearer tokens, and high-entropy base64 strings are replaced with `[REDACTED_TOKEN]` before any write.

**Path allowlist** — Filesystem watching is restricted to `allowPaths`. Nothing outside those paths is observed.

**Audit log** — Every write is appended to `~/.threadline/audit/events.jsonl`. Inspect it at any time.

**Reversible cleanup** — Files are moved to `~/.threadline/quarantine/<id>/` with a full manifest, never deleted.

---

## Repository Layout

```
threadline/
├── packages/
│   ├── common/            Domain types · Zod schemas
│   └── engine-core/       Deterministic pipeline (no I/O)
│                          clustering · commitments · summarization · scoring
│
├── apps/
│   ├── mcp-server/
│   │   ├── src/storage/   IStore interface · JsonStore · migrations
│   │   │                  repositories · search index · audit log · collector registry
│   │   ├── src/collectors/ 8 collectors (filesystem · git · clipboard · active window
│   │   │                  browser history · Claude sessions · Beads · tasks/plans)
│   │   ├── src/daemon/    Fastify HTTP · /ui · /api/import-thread · scheduler
│   │   ├── src/tools/     20 MCP tool handlers
│   │   ├── src/security/  Redaction · path safety · permission guard
│   │   └── src/main.ts    Entry point · batched ingest · graceful shutdown
│   │
│   ├── browser-extension/ Chrome MV3 (background · options · popup)
│   └── installer/         CLI installer · per-host config writers
│
├── skills/threadline/     Claude Skill bundle (SKILL.md · references · scripts)
├── scripts/               package-skill · package-extension · verify-no-placeholders
└── tests/
    ├── unit/              7 suites
    ├── integration/        4 suites
    └── evals/             4 narrative fixtures
```

---

## Development

```bash
pnpm build              # Compile all packages
pnpm test               # Vitest — 58 tests, ~2s
pnpm lint               # Biome lint + format check
pnpm verify             # Scan for TODO / FIXME / stubs
pnpm package:skill      # → dist/skill.zip
pnpm package:extension  # → dist/extension.zip
pnpm doctor             # Check installation health
```

---

## Contributing

```bash
# Before opening a PR
pnpm build && pnpm test && pnpm lint && pnpm verify
```

Open an issue before submitting a large feature or refactor.

---

<div align="center">

Built by [Atharva Date](https://github.com/ADIITJ)

[MIT License](LICENSE) · © 2026 Atharva Date

</div>
