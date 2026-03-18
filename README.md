# Threadline

Local-first work-memory layer for AI agents. Threadline tracks what you're working
on, reconstructs context threads, and surfaces open commitments — without sending
your data anywhere.

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agent Host                           │
│              (Claude Code / Desktop / Cursor / etc.)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MCP (14 tools)
┌───────────────────────────▼─────────────────────────────────────┐
│                      Threadline MCP Server                      │
│                                                                 │
│   ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│   │ Thread Engine│   │ Storage Layer │   │   Daemon HTTP    │  │
│   │              │   │ (JsonStore)   │   │  :47821          │  │
│   │ • Clustering │   │ • Events      │   │                  │  │
│   │ • Commitments│   │ • Threads     │   │ POST /ingest/    │  │
│   │ • Summaries  │   │ • Artifacts   │   │  browser-event   │  │
│   │ • Scoring    │   │ • Commitments │   │  checkpoint      │  │
│   └──────────────┘   └───────────────┘   └──────────────────┘  │
└──────┬─────────────────────────────────────────────────────┬────┘
       │                                                     │
┌──────▼──────────────────────┐          ┌──────────────────▼─────┐
│        Collectors           │          │   Browser Extension    │
│                             │          │   (Chrome MV3)         │
│ • Filesystem (chokidar)     │          │                        │
│ • Git (simple-git)          │          │ Sends tab events to    │
│ • Clipboard (pbpaste/xclip) │          │ daemon ingest endpoint │
│ • Active window (optional)  │          └────────────────────────┘
│ • Manual checkpoints        │
└─────────────────────────────┘
              │
┌─────────────▼───────────────┐
│     ~/.threadline/          │
│     • db/                   │
│     • audit/events.jsonl    │
│     • quarantine/           │
│     • config.json           │
└─────────────────────────────┘
```

## Features

- **14 MCP tools** — resume, search, commitments, handoff, cleanup, checkpoint, archive
- **Local only** — all data stored in `~/.threadline/`, no network calls
- **Thread reconstruction** — episode segmentation + signature-overlap clustering
- **Commitment extraction** — regex patterns + NLP date parsing (chrono-node)
- **Safe cleanup** — Downloads folder cleanup with full undo manifest
- **Browser extension** — Chrome MV3, posts tab events to local daemon
- **Privacy-first** — incognito ignored, secrets redacted, explicit path allowlist

## Quick Start

```sh
# Clone and install
git clone https://github.com/ADIITJ/threadline
cd threadline
pnpm install

# Build all packages
pnpm build

# Install into Claude Code
node apps/installer/dist/cli.js install --host claude-code

# Or use the install script
chmod +x scripts/install-local.sh
./scripts/install-local.sh
```

## Host Configuration

### Claude Code (`~/.claude/mcp.json`)

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

See `examples/` for all host configurations.

## MCP Tools

| Tool | Description |
|------|-------------|
| `health` | Daemon status and collector state |
| `list_recent_threads` | Threads sorted by last activity |
| `get_thread_details` | Full thread view |
| `get_thread_timeline` | Chronological event list |
| `resume_last_thread` | Resume card for most recent thread |
| `search_threads` | Full-text search |
| `find_commitments` | Open/done commitments |
| `prepare_handoff` | Handoff document |
| `safe_clean_downloads` | Downloads cleanup (dryRun by default) |
| `undo_last_cleanup` | Restore last cleanup |
| `explain_why_open` | Context for a file or URL |
| `open_thread_artifacts` | Open files/URLs |
| `capture_checkpoint` | Save manual checkpoint |
| `archive_thread` | Archive a thread |

## Development

```sh
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Biome lint + format check
pnpm verify       # Check for placeholders/stubs
pnpm package:skill      # Build dist/skill.zip
pnpm package:extension  # Build dist/extension.zip
pnpm doctor       # Check installation status
```

## Privacy

- All data is local (`~/.threadline/`)
- No telemetry, no cloud sync
- Incognito browser sessions ignored
- Secrets redacted before storage
- Filesystem watching limited to explicit allowlist
- Audit log at `~/.threadline/audit/events.jsonl`

## Architecture

```
packages/
  common/          # Domain types + Zod schemas
  engine-core/     # Thread clustering, commitment extraction, scoring

apps/
  mcp-server/      # MCP server + collectors + daemon + storage
  browser-extension/ # Chrome MV3 extension
  installer/       # CLI installer for all hosts

skills/threadline/ # Claude Skill bundle (SKILL.md + scripts + references)
scripts/           # Build and packaging scripts
tests/             # Unit, integration, and eval tests
```

## License

MIT
