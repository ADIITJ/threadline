<div align="center">

<img src="skills/threadline/assets/icon.svg" width="80" height="80" alt="Threadline" />

# Threadline

**Local-first work-memory for AI agents**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/Protocol-MCP-purple)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-58%20passing-brightgreen)](#testing)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io)

Threadline passively tracks your work across files, git, browser tabs, and clipboard —
then reconstructs that context into threads, surfaces open commitments, and gives AI agents
a coherent picture of what you were doing, without sending your data anywhere.

[Getting Started](#getting-started) · [MCP Tools](#mcp-tools) · [Architecture](#architecture) · [Configuration](#configuration) · [Privacy](#privacy) · [Contributing](#contributing)

</div>

---

## Overview

Modern AI coding assistants are stateless. Every session starts cold. Threadline fixes this by acting as a persistent memory layer: it observes your local environment in real time, groups related activity into **threads**, extracts **commitments** you've made, and serves all of this to your AI agent through a standard MCP interface.

```
You open your terminal after lunch.
Agent calls resume_last_thread().

  ┌─────────────────────────────────────────────┐
  │  ## fix oauth callback in api repo          │
  │  State: active  |  Last active: 2h ago      │
  │                                             │
  │  > 8 events · repos: api · ~2h session      │
  │                                             │
  │  Recent activity:                           │
  │  - committed: fix: validate redirect URI    │
  │  - modified: src/auth.ts                    │
  │                                             │
  │  Open commitments:                          │
  │  - [ ] Add integration test for callback    │
  │                                             │
  │  Key artifacts:                             │
  │  - /projects/api/src/auth.ts                │
  │  - https://oauth.net/2/                     │
  └─────────────────────────────────────────────┘
```

No manual logging. No cloud sync. No configuration beyond installation.

---

## Highlights

| | |
|---|---|
| **14 MCP tools** | Resume, search, commitments, handoff, cleanup, checkpoint, archive |
| **Thread reconstruction** | Episode segmentation → signature-overlap clustering → state scoring |
| **Commitment extraction** | 13 regex patterns + chrono-node NLP date parsing |
| **Safe file cleanup** | Downloads quarantine with atomic undo manifests |
| **Chrome extension** | MV3 background worker — posts tab events to local daemon |
| **Multi-host installer** | Claude Code · Claude Desktop · Cursor · VS Code · Codex |
| **Zero native deps** | Pure-JS storage; runs on Node 20+ including Node 25 |
| **Privacy-first** | All data in `~/.threadline/` · secrets redacted · audit log |

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- pnpm 8 or later (`npm install -g pnpm`)
- Git

### Installation

```bash
git clone https://github.com/ADIITJ/threadline.git
cd threadline
pnpm install
pnpm build
```

### Connect to your AI host

```bash
# Detect and configure automatically
node apps/installer/dist/cli.js install --host auto

# Or target a specific host
node apps/installer/dist/cli.js install --host claude-code
node apps/installer/dist/cli.js install --host claude-desktop
node apps/installer/dist/cli.js install --host cursor
node apps/installer/dist/cli.js install --host vscode
node apps/installer/dist/cli.js install --host codex
```

Verify the installation:

```bash
node apps/installer/dist/cli.js doctor
```

```
=== Threadline Doctor ===

Server binary:  apps/mcp-server/dist/main.js  ✓
Default port:   47821  (free)
Home dir:       ~/.threadline  (will be created on first run)
```

### One-line install (macOS / Linux)

```bash
chmod +x scripts/install-local.sh && ./scripts/install-local.sh
```

```powershell
# Windows (PowerShell)
.\scripts\install-local.ps1
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          AI Agent Host                               │
│            Claude Code · Claude Desktop · Cursor · VS Code           │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  Model Context Protocol (14 tools)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Threadline MCP Server                         │
│                                                                      │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │  Thread Engine  │   │  Storage Layer   │   │   HTTP Daemon    │  │
│  │                 │   │   (JsonStore)    │   │   :47821         │  │
│  │  Episode        │   │                  │   │                  │  │
│  │  segmentation   │   │  events          │   │  POST            │  │
│  │                 │   │  threads         │   │  /ingest/        │  │
│  │  Signature      │   │  artifacts       │   │  browser-event   │  │
│  │  clustering     │   │  commitments     │   │  checkpoint      │  │
│  │                 │   │  checkpoints     │   │                  │  │
│  │  Commitment     │   │  cleanup         │   │  GET             │  │
│  │  extraction     │   │  manifests       │   │  /health         │  │
│  │                 │   │                  │   │  /threads/recent │  │
│  │  State scoring  │   │  Search index    │   │                  │  │
│  └─────────────────┘   └──────────────────┘   └──────────────────┘  │
└────────┬─────────────────────────────────────────────────┬───────────┘
         │                                                 │
┌────────▼────────────────────────┐       ┌───────────────▼────────────┐
│           Collectors            │       │      Browser Extension     │
│                                 │       │        (Chrome MV3)        │
│  Filesystem   chokidar          │       │                            │
│  Git          simple-git        │       │  tabs.onCreated            │
│  Clipboard    pbpaste / xclip   │       │  tabs.onUpdated            │
│  Active window  (optional)      │       │  tabs.onRemoved            │
│  Manual checkpoints             │       │                            │
│                                 │       │  Filters incognito         │
│  Scheduler: cluster 5min        │       │  Filters chrome://         │
│             score   15min       │       │  POSTs to :47821           │
└────────┬────────────────────────┘       └────────────────────────────┘
         │
┌────────▼────────────────────────┐
│        ~/.threadline/           │
│                                 │
│  db/          JSON stores       │
│  audit/       events.jsonl      │
│  quarantine/  cleanup manifests │
│  config.json                    │
└─────────────────────────────────┘
```

### Repository layout

```
threadline/
├── packages/
│   ├── common/          Domain types, Zod schemas, constants
│   └── engine-core/     Clustering, commitment extraction, scoring
│
├── apps/
│   ├── mcp-server/      MCP server, collectors, daemon, storage, tools
│   ├── browser-extension/  Chrome MV3 extension
│   └── installer/       CLI installer for all host configurations
│
├── skills/threadline/   Claude Skill bundle (SKILL.md, scripts, references)
├── scripts/             Build, packaging, and verification scripts
├── tests/               Unit, integration, and eval test suites
└── examples/            Host configuration examples
```

---

## MCP Tools

All 14 tools operate on local data only. No network calls are made.

### Context & Resumption

| Tool | Input | Description |
|------|-------|-------------|
| `resume_last_thread` | — | Resume card for the most recently active thread |
| `get_thread_details` | `threadId` | Full detail view: events, artifacts, commitments |
| `get_thread_timeline` | `threadId`, `limit?` | Chronological event list |
| `explain_why_open` | `locator` | Why a file or URL is associated with current work |

### Discovery & Search

| Tool | Input | Description |
|------|-------|-------------|
| `list_recent_threads` | `limit?`, `state?` | Threads sorted by last activity |
| `search_threads` | `query` | Full-text search across threads and events |
| `find_commitments` | `status?`, `threadId?` | Open or completed commitments |

### Actions

| Tool | Input | Description |
|------|-------|-------------|
| `capture_checkpoint` | `title`, `note?` | Save a manual checkpoint with commitment extraction |
| `prepare_handoff` | `threadId` | Generate a structured handoff document |
| `open_thread_artifacts` | `threadId` | Open thread files and URLs in default apps |
| `archive_thread` | `threadId` | Mark a thread as archived |

### Cleanup

| Tool | Input | Description |
|------|-------|-------------|
| `safe_clean_downloads` | `dryRun?` | Preview or execute Downloads cleanup (default: dry run) |
| `undo_last_cleanup` | — | Restore the most recent cleanup manifest |
| `health` | — | Daemon status, collector state, thread counts |

---

## How Thread Reconstruction Works

Threadline uses a three-stage pipeline to convert raw events into coherent threads:

**1 — Episode segmentation**
Events are grouped into episodes by time proximity. A gap of ≥ 30 minutes between events marks an episode boundary. Each episode represents a single uninterrupted work session.

**2 — Signature extraction**
Each episode is reduced to a signature: a set of tokens extracted from file paths, git repository names, URLs, and free text. Common stop words and short tokens are filtered. The result is a bag-of-words representation of what the episode was about.

**3 — Clustering**
New episodes are scored against existing thread signatures using Jaccard overlap. If the best match exceeds the threshold, the episode is merged into that thread (and the thread signature is updated). Otherwise, a new thread is created. Thread state (active, stale, archived) is re-scored on a 15-minute schedule.

---

## Configuration

The config file is created at `~/.threadline/config.json` on first run.

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

| Key | Default | Description |
|-----|---------|-------------|
| `allowPaths` | Desktop, Downloads, Documents | Filesystem paths watched for events |
| `downloadCleanupThreshold` | `3` | Age in days before a file is a cleanup candidate |
| `ignorePrivateBrowser` | `true` | Ignore events from incognito/private browser sessions |
| `maxStoredClipboardChars` | `2000` | Clipboard text is truncated and redacted at this length |
| `daemonPort` | `47821` | Local HTTP daemon port for browser extension ingest |

### Host configuration examples

<details>
<summary>Claude Code <code>~/.claude/mcp.json</code></summary>

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
<summary>Claude Desktop <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></summary>

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
<summary>Cursor <code>.cursor/mcp.json</code></summary>

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
<summary>VS Code / GitHub Copilot <code>.vscode/mcp.json</code></summary>

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
<summary>Codex <code>codex.config.toml</code></summary>

```toml
[mcp_servers.threadline]
command = "node"
args = ["/path/to/threadline/apps/mcp-server/dist/main.js"]
```
</details>

---

## Privacy

Threadline is designed so that you never have to trust it.

| Guarantee | Detail |
|-----------|--------|
| **Local only** | All data is stored in `~/.threadline/`. No outbound network requests. |
| **No keylogging** | Threadline does not capture keystrokes or continuous input. |
| **Secret redaction** | API keys, tokens, and high-entropy strings are replaced with `[REDACTED_TOKEN]` before storage. |
| **Incognito ignored** | Browser events from private/incognito sessions are discarded. |
| **Path allowlist** | Filesystem watching is restricted to explicitly allowed paths. |
| **Reversible cleanup** | `safe_clean_downloads` moves files to quarantine — never deletes. Every move is undoable. |
| **Audit log** | All writes are appended to `~/.threadline/audit/events.jsonl` in append-only format. |

**Data stored:** file path and modification events, git branch and commit metadata, clipboard text (capped and redacted), browser tab URL and title, manual checkpoint notes.

**Data never stored:** file contents, browser page HTML, keystrokes, screen recordings, network traffic, credentials.

---

## Development

### Commands

```bash
pnpm build              # Compile all packages via turbo
pnpm test               # Run 58 unit + integration + eval tests (vitest)
pnpm lint               # Biome lint and format check
pnpm verify             # Scan for unfinished stubs or placeholders
pnpm package:skill      # Package skills/threadline/ → dist/skill.zip
pnpm package:extension  # Package browser-extension/dist/ → dist/extension.zip
pnpm doctor             # Check installation health
```

### Testing

The test suite is split into three layers:

```
tests/
├── unit/           Isolated logic: redaction, signatures, segmentation,
│                   clustering, commitments, cleanup
├── integration/    Full pipeline: browser events, checkpoints, thread
│                   listing, installer config generation
└── evals/          Narrative quality checks: resumption, buried commitments,
                    downloads cleanup, stale thread handoff
```

```bash
pnpm test

# Test Files  14 passed (14)
#      Tests  58 passed (58)
#   Duration  ~2s
```

### Project structure

```
packages/common/
  src/domain/         Event, Thread, Artifact, Commitment, Checkpoint, Cleanup
  src/schemas.ts      Zod schemas for all domain types and tool inputs
  src/constants.ts    EPISODE_GAP_MS, STALE_THREAD_DAYS, DEFAULT_DAEMON_PORT

packages/engine-core/
  src/clustering.ts   Tokenize → signature → Jaccard overlap → cluster
  src/commitments.ts  13 regex patterns + chrono-node date extraction
  src/summarization.ts  Deterministic title and summary generation
  src/scoring.ts      Thread state scoring (active / stale / archived)

apps/mcp-server/
  src/storage/        JsonStore, repositories, search index, audit log
  src/collectors/     Filesystem, git, clipboard, active window
  src/daemon/         Fastify HTTP server, ingest routes, scheduler
  src/engine/         Clustering, resume card, handoff, presence explanation
  src/tools/          14 MCP tool handlers
  src/security/       Secret redaction, path safety, permission guard
  src/main.ts         Server entry point, tool registration, shutdown
```

---

## Browser Extension

The Chrome MV3 extension connects to the local daemon to stream tab events.

**Permissions:** `tabs`, `storage`, `alarms`
**Host permissions:** `http://127.0.0.1/*`

To install in developer mode:
1. Run `pnpm build` to compile the extension
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select `apps/browser-extension/dist/`

The extension never connects to any external service. It only POSTs to `http://127.0.0.1:47821/ingest/browser-event`.

---

## Contributing

Contributions are welcome. Please open an issue before submitting a large change.

```bash
# Run the full check suite before opening a PR
pnpm build && pnpm test && pnpm lint && pnpm verify
```

---

## License

[MIT](LICENSE) © 2026 Aashish Date
