<div align="center">

<br />

<img src="skills/threadline/assets/icon.svg" width="96" alt="Threadline" />

<br />
<br />

<h1>Threadline</h1>

<p><strong>Your AI has no memory. Until now.</strong></p>

<p>
  Threadline is a passive, local-first work-memory engine for AI agents.<br />
  It watches what you do — silently, privately — and gives your AI a complete<br />
  picture of your work without you ever having to explain it twice.
</p>

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-20_Tools-7c3aed?style=for-the-badge)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/Tests-58_Passing-22c55e?style=for-the-badge)](tests/)
[![Zero Cloud](https://img.shields.io/badge/Cloud-Zero-ef4444?style=for-the-badge)](#privacy)

<br />

**Works with →**&nbsp;
[Claude Code](examples/.mcp.json) · [Claude Desktop](examples/claude_desktop_config.json) · [Cursor](examples/cursor.mcp.json) · [VS Code](examples/.vscode/mcp.json) · [Codex](examples/codex.config.toml)

<br />

</div>

---

<br />

## The Problem

Every AI coding session starts cold.

You open Claude. You open Cursor. And you spend the first five minutes doing the same thing you did yesterday — re-explaining your project, pasting file contents, describing what you were trying to do, reminding it what you promised yourself you'd finish.

This is friction that compounds. Every day. Every session. Forever.

**Tools like Beads made you solve this manually.** You had to remember to say "remember this." You were managing the memory of a tool that was supposed to help you. That's backwards.

Threadline is different. **It watches. It learns. It remembers. You do nothing.**

<br />

---

## Demo

> Open your terminal after a two-hour break. Your AI already knows everything.

```
$ # New Claude session. No context pasted. No re-explaining.

Agent → resume_last_thread()

  ╔══════════════════════════════════════════════════════════════╗
  ║  fix oauth callback in api repo                             ║
  ║  State: active  ·  Last active: 2h ago  ·  8 events        ║
  ╠══════════════════════════════════════════════════════════════╣
  ║                                                             ║
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
  ║  ├─ src/middleware/session.ts                               ║
  ║  └─ https://oauth.net/2/pkce                                ║
  ╚══════════════════════════════════════════════════════════════╝
```

```
$ # Three days later. Different machine. Same project.

Agent → search_threads("oauth")
Agent → prepare_handoff(threadId)

  ## Handoff: fix oauth callback in api repo

  Summary: Implemented PKCE flow for the OAuth callback handler.
  Redirect URI validation is in place. Integration test is still
  outstanding — see open commitments.

  Timeline
  ├─ [Mar 17 · 14:02]  git/commit — fix: validate redirect URI
  ├─ [Mar 17 · 13:44]  file/modify — src/auth/callback.ts
  └─ [Mar 17 · 11:20]  browser/tab — oauth.net/2/pkce

  Open commitments
  └─ [ ] Add integration test for callback handler
```

<br />

---

## How It Works

Threadline runs a background daemon that observes your local environment across eight signal sources, then uses a three-stage pipeline to reconstruct coherent work sessions.

```
  Signal sources                  Engine                    Output

  ┌──────────────┐                                        ┌──────────────┐
  │  Filesystem  │──┐                                     │   Threads    │
  │  Git         │  │   ┌─────────────────────────────┐  │  grouped by  │
  │  Clipboard   │  │   │                             │  │  project     │
  │  Active Win  │──┼──▶│  1. Episode segmentation    │  └──────────────┘
  │  Browser     │  │   │     30-min gap = new episode│
  │  history     │  │   │  2. Signature extraction    │  ┌──────────────┐
  │  Claude      │  │   │     tokenize paths, URLs,   │  │ Commitments  │
  │  sessions    │──┤   │     repos → bag-of-words    │  │  extracted   │
  │  Beads       │  │   │  3. Jaccard clustering      │  │  with dates  │
  │  memory      │  │   │     overlap score vs open   │  └──────────────┘
  │  Claude      │  │   │     thread signatures       │
  │  tasks/plans │──┘   │                             │  ┌──────────────┐
                        └─────────────────────────────┘  │  Artifacts   │
                                                          │  Files, URLs │
                                                          └──────────────┘
```

**Episode segmentation** — A gap of ≥ 30 minutes between events marks an episode boundary. Short gaps within a work session are preserved as continuity.

**Signature extraction** — Each episode is reduced to a token set from file paths, repo names, URL hostnames, and free text. Stop words and single-character tokens are filtered. The result is a bag-of-words fingerprint of what the episode was about.

**Jaccard clustering** — New episodes are scored against all open thread signatures using Jaccard overlap. Best match above threshold → merge and update signature. No match → new thread created. Thread state (active / stale / archived) is re-evaluated every 15 minutes.

<br />

---

## Threadline vs Everything Else

|  | **Threadline** | Beads / Memory plugins | Notebook / manual logs | Cloud AI memory |
|--|:-:|:-:|:-:|:-:|
| Fully passive — no manual input | ✅ | ❌ | ❌ | ❌ |
| Reconstructs timeline from events | ✅ | ❌ | ❌ | ❌ |
| Extracts commitments automatically | ✅ | ❌ | ❌ | ❌ |
| 100% local — no cloud | ✅ | ✅ | ✅ | ❌ |
| Works across all MCP-compatible hosts | ✅ | Partial | ❌ | ❌ |
| Reversible file cleanup with undo | ✅ | ❌ | ❌ | ❌ |
| Browser tab tracking | ✅ | ❌ | ❌ | Partial |
| Git-aware | ✅ | ❌ | ❌ | ❌ |
| Secret redaction before storage | ✅ | ❌ | ❌ | ❌ |
| Handoff document generation | ✅ | ❌ | ❌ | ❌ |

The core difference: **Beads stores what you tell it. Threadline discovers what you did.**

<br />

---

## Getting Started

### Requirements

- Node.js 20+ (including Node 25 — zero native dependencies)
- pnpm 8+

### Install

```bash
git clone https://github.com/ADIITJ/threadline.git
cd threadline
pnpm install && pnpm build
```

### Connect to your host

```bash
# Auto-detect and configure
node apps/installer/dist/cli.js install --host auto

# Or pick one
node apps/installer/dist/cli.js install --host claude-code
node apps/installer/dist/cli.js install --host claude-desktop
node apps/installer/dist/cli.js install --host cursor
node apps/installer/dist/cli.js install --host vscode
node apps/installer/dist/cli.js install --host codex

# Print config without writing (copy-paste into your editor)
node apps/installer/dist/cli.js install --host claude-code --print

# Generate a natural-language setup prompt for Claude / Codex / Copilot
node apps/installer/dist/cli.js prompt --host claude-code
```

### Verify

```bash
node apps/installer/dist/cli.js doctor
```

```
=== Threadline Doctor ===

Server binary   apps/mcp-server/dist/main.js     ✓  found
Daemon port     47821                             ✓  free
Home dir        ~/.threadline                     ✓  ready
```

### One-liner (macOS / Linux)

```bash
chmod +x scripts/install-local.sh && ./scripts/install-local.sh
```

```powershell
# Windows
.\scripts\install-local.ps1
```

<br />

---

## MCP Tools

Threadline exposes 20 tools over the Model Context Protocol. All tools are available in tool-only mode — no resources or prompts required.

<details open>
<summary><strong>Context & Resumption</strong></summary>

<br />

| Tool | Description |
|------|-------------|
| `resume_last_thread` | Build a full resume card for the most recently active thread — events, artifacts, open commitments |
| `get_thread_details` | Complete view of a single thread by ID |
| `get_thread_timeline` | Chronological event list for a thread |
| `explain_why_open` | Explain why a specific file or URL is associated with your current work |

</details>

<details>
<summary><strong>Discovery & Search</strong></summary>

<br />

| Tool | Description |
|------|-------------|
| `list_recent_threads` | All threads sorted by last activity, with optional state filter |
| `search_threads` | Full-text search across thread titles, summaries, and events |
| `search_events` | Filter raw events by source, kind, thread, date range, or text query |
| `find_commitments` | Surface open or completed commitments, optionally filtered by thread |
| `list_projects` | Group all threads by project/working directory with open commitment counts |

</details>

<details>
<summary><strong>Thread Management</strong></summary>

<br />

| Tool | Description |
|------|-------------|
| `split_thread` | Split selected events from a thread into a new standalone thread |
| `merge_threads` | Merge a source thread into a target — reassigns events, artifacts, and commitments |
| `export_thread` | Serialize a thread to portable JSON for backup or team sharing |
| `import_thread` | Import a previously exported thread JSON, remapping all IDs to avoid conflicts |

</details>

<details>
<summary><strong>Actions</strong></summary>

<br />

| Tool | Description |
|------|-------------|
| `capture_checkpoint` | Save a manual checkpoint — notes are parsed for commitments and due dates |
| `prepare_handoff` | Generate a structured handoff document for a thread |
| `open_thread_artifacts` | Open thread files and URLs in default system apps |
| `archive_thread` | Mark a thread as archived |

</details>

<details>
<summary><strong>Cleanup</strong></summary>

<br />

| Tool | Description |
|------|-------------|
| `safe_clean_downloads` | Preview or execute Downloads folder cleanup — dry-run by default, all moves reversible |
| `undo_last_cleanup` | Restore the most recent cleanup manifest to original paths |
| `health` | Daemon status, per-collector stats, due-today commitment alerts, schema version |

</details>

<br />

---

## Privacy

Threadline is designed so you never have to trust it blindly.

```
What Threadline stores                   What Threadline never stores
─────────────────────────────────────    ────────────────────────────────────
File paths and modification timestamps   File contents (except small text hash)
Git branch names and commit metadata     Browser page HTML or content
Browser tab URL and title                Keystrokes
Clipboard text (capped, redacted)        Screen recordings
Manual checkpoint notes                  Network traffic
                                         Passwords or credentials
```

**Secret redaction** — Before persisting any text, Threadline applies a heuristic redaction pass covering API keys (`sk-`, `ghp_`, `AKIA...`), Bearer tokens, high-entropy base64 strings, and common secret patterns. Matched content is replaced with `[REDACTED_TOKEN]`.

**Path allowlist** — Filesystem watching is restricted to an explicit allowlist. Default: `~/Desktop`, `~/Downloads`, `~/Documents`. Nothing outside these paths is ever observed.

**Audit log** — Every write is appended to `~/.threadline/audit/events.jsonl` in append-only format. You can inspect exactly what Threadline has stored at any time.

**Reversible cleanup** — `safe_clean_downloads` never permanently deletes. Files are moved to `~/.threadline/quarantine/<manifest-id>/` with a full manifest. `undo_last_cleanup` restores them.

**Incognito ignored** — Browser events from private/incognito sessions are discarded by default (`ignorePrivateBrowser: true`).

<br />

---

## Configuration

Created at `~/.threadline/config.json` on first run. All fields are optional.

```json
{
  "homeDir": "~/.threadline",
  "daemonPort": 47821,
  "allowPaths": [
    "~/Desktop",
    "~/Downloads",
    "~/Documents"
  ],
  "downloadCleanupThreshold": 3,
  "ignorePrivateBrowser": true,
  "maxStoredClipboardChars": 2000,
  "logLevel": "info"
}
```

<details>
<summary>All configuration keys</summary>

<br />

| Key | Default | Description |
|-----|---------|-------------|
| `allowPaths` | Desktop, Downloads, Documents | Paths watched by the filesystem collector |
| `daemonPort` | `47821` | Local HTTP port for browser extension ingest |
| `downloadCleanupThreshold` | `3` | Age in days before a file becomes a cleanup candidate |
| `ignorePrivateBrowser` | `true` | Discard events from incognito/private sessions |
| `maxStoredClipboardChars` | `2000` | Clipboard text is truncated and redacted at this limit |
| `logLevel` | `"info"` | Log verbosity: `"debug"`, `"info"`, `"warn"`, `"error"` |
| `enableBrowserHistoryWatcher` | `true` | Read browser history SQLite files (Chrome/Brave/Firefox/Safari) |
| `enableClaudeSessionWatcher` | `true` | Watch `~/.claude/projects/**/*.jsonl` for Claude Code session context |
| `enableBeadsMemoryWatcher` | `true` | Watch `~/.claude/projects/*/memory/*.md` for Beads memory changes |
| `enableClaudeTaskWatcher` | `true` | Poll `~/.claude/todos/` and `~/.claude/plans/` for task/plan changes |
| `enableBrowserIngest` | `true` | Accept events from the browser extension at `/ingest/browser-event` |

</details>

<br />

### Host configuration

<details>
<summary>Claude Code &nbsp;<code>~/.claude/mcp.json</code></summary>

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
<summary>Claude Desktop &nbsp;<code>~/Library/Application Support/Claude/claude_desktop_config.json</code></summary>

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
<summary>Cursor &nbsp;<code>.cursor/mcp.json</code></summary>

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
<summary>VS Code / GitHub Copilot &nbsp;<code>.vscode/mcp.json</code></summary>

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
<summary>Codex &nbsp;<code>codex.config.toml</code></summary>

```toml
[mcp_servers.threadline]
command = "node"
args = ["/path/to/threadline/apps/mcp-server/dist/main.js"]
```
</details>

<br />

---

## Browser Extension

The Chrome MV3 extension streams tab events to the local daemon.

**Permissions:** `tabs` · `storage` · `alarms`
**Host permissions:** `http://127.0.0.1/*` only — no external connections

```bash
# Build the extension
pnpm build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Load unpacked → apps/browser-extension/dist/
```

The extension never communicates with any server outside your machine. It only POSTs to `http://127.0.0.1:47821/ingest/browser-event`.

A Chrome Alarms keep-alive pings the daemon every 24 seconds so the MV3 service worker never goes idle.

<br />

---

## Local Web UI

A lightweight status dashboard is served at `http://127.0.0.1:47821/ui` while the daemon is running.

- Live health check and version info
- Recent threads with last-active timestamps
- Auto-refreshes every 30 seconds
- No build step — single self-contained HTML file

<br />

---

## Team / Shared Mode

Thread context can be exported and imported across machines:

```bash
# Export a thread to JSON (via MCP or HTTP)
export_thread(threadId="...")        # returns portable JSON string

# Import on another machine
import_thread(data="<json string>")  # remaps all IDs, prefixes title with [imported]

# Or POST directly to the daemon
curl -X POST http://127.0.0.1:47821/api/import-thread \
  -H "Content-Type: application/json" \
  -d '{"data": "<json string>"}'
```

<br />

---

## Repository Layout

```
threadline/
│
├── packages/
│   ├── common/              Domain types (Event, Thread, Artifact, Commitment)
│   │   ├── src/domain/      TypeScript interfaces
│   │   └── src/schemas.ts   Zod schemas for all types and tool inputs
│   │
│   └── engine-core/         Deterministic engine logic (no I/O)
│       ├── clustering.ts    Tokenize → signature → Jaccard overlap → thread
│       ├── commitments.ts   13 regex patterns + chrono-node date extraction
│       ├── summarization.ts Title and summary generation
│       └── scoring.ts       Thread state scoring (active / stale / archived)
│
├── apps/
│   ├── mcp-server/          Core server
│   │   ├── src/storage/     IStore interface, JsonStore, repositories, migrations,
│   │   │                    search index, audit log, collector stats registry
│   │   ├── src/collectors/  Filesystem, Git, Clipboard, Active window,
│   │   │                    Browser history, Claude sessions/tasks/plans, Beads memory
│   │   ├── src/daemon/      Fastify HTTP server (/ui + /api/import-thread),
│   │   │                    ingest routes, scheduler (commitment alerts + auto-close)
│   │   ├── src/engine/      Clustering, resume card, handoff, presence
│   │   ├── src/tools/       20 MCP tool handlers
│   │   ├── src/security/    Secret redaction, path safety, permission guard
│   │   └── src/main.ts      Entry point, batched ingest, tool registration, shutdown
│   │
│   ├── browser-extension/   Chrome MV3
│   │   └── src/             background.ts, options, popup, manifest.json
│   │
│   └── installer/           CLI installer
│       └── src/hosts/       Per-host config writers (Claude, Cursor, VS Code, Codex)
│
├── skills/threadline/        Claude Skill bundle
│   ├── SKILL.md             Trigger rules and tool usage patterns
│   ├── agents/openai.yaml   OpenAI-compatible agent metadata
│   ├── references/          6 reference docs (privacy, cleanup, templates…)
│   └── scripts/             7 utility scripts for bootstrapping and exporting
│
├── scripts/                  Build and packaging
│   ├── package-skill.mjs    Packs skills/ → dist/skill.zip
│   ├── package-extension.mjs  Packs extension/dist/ → dist/extension.zip
│   └── verify-no-placeholders.mjs  Scans for unfinished stubs
│
└── tests/
    ├── unit/                Redaction, signatures, clustering, commitments, cleanup
    ├── integration/         Full pipeline: ingest → cluster → list → resume
    └── evals/               Narrative quality: resumption, handoff, buried commitments
```

<br />

---

## Development

```bash
pnpm build              # Compile all packages via Turbo
pnpm test               # Run the full test suite (Vitest)
pnpm lint               # Biome lint + format check
pnpm verify             # Scan source for unfinished stubs or placeholders
pnpm package:skill      # Build dist/skill.zip
pnpm package:extension  # Build dist/extension.zip
pnpm doctor             # Check installation health
```

### Test suite

```
tests/
├── unit/           7 suites — redaction, signatures, segmentation,
│                              clustering, commitments, cleanup, scoring
├── integration/    4 suites — browser events, checkpoints,
│                              thread listing, installer config
└── evals/          4 fixtures — interruption resume, buried commitments,
                                 downloads cleanup, stale thread handoff

Test Files   14 passed
Tests        58 passed
Duration     ~2s
```

<br />

---

## Roadmap

- [x] Thread export/import for team sharing
- [x] Local web UI dashboard at `/ui`
- [x] Per-collector health stats in `health` tool
- [x] Proactive commitment due-date alerts
- [x] Ingest rate limiting (2-second batch queue)
- [x] Storage abstraction layer (IStore) for future SQLite swap
- [ ] VS Code sidebar panel for thread browsing
- [ ] Firefox extension (MV3)
- [ ] Linear / GitHub Issues commitment sync
- [ ] Configurable clustering threshold per project
- [ ] SQLite backend (drop-in via `SqliteStore implements IStore`)
- [ ] Webhook push for team thread summaries

<br />

---

## Contributing

Issues and pull requests are welcome.

```bash
# Before opening a PR
pnpm build && pnpm test && pnpm lint && pnpm verify
```

Please open an issue before submitting a large feature or refactor so we can align on approach first.

<br />

---

<div align="center">

Built by **Atharva Date**

[GitHub](https://github.com/ADIITJ) · [LinkedIn](https://www.linkedin.com/in/atharva-date-a956b6256/)

<br />

*If Threadline saved you from explaining yourself to Claude one more time, consider giving it a star.*

⭐

<br />

[MIT License](LICENSE) · © 2026 Atharva Date

</div>
