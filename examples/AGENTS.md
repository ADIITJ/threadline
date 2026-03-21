# Threadline — Agent Tool Reference

Threadline exposes 20 MCP tools. All tools are available via tool-calling —
no resources or prompts required.

## Tool Summary

| Tool | Purpose |
|------|---------|
| `health` | Verify daemon is running; returns per-collector stats and due-today commitment alerts |
| `list_recent_threads` | List work threads by recency |
| `get_thread_details` | Get full detail for a thread by ID |
| `get_thread_timeline` | Get chronological events for a thread |
| `resume_last_thread` | Build a resume card for the most recent thread |
| `search_threads` | Search thread titles, summaries, and events |
| `search_events` | Filter raw events by source, kind, thread, date range, or text query |
| `find_commitments` | Find open/done commitments across threads |
| `list_projects` | Group threads by project with open commitment counts |
| `prepare_handoff` | Generate a handoff document for a thread |
| `safe_clean_downloads` | Preview or clean the Downloads folder |
| `undo_last_cleanup` | Restore the most recent cleanup |
| `explain_why_open` | Explain why a file/URL is in context |
| `open_thread_artifacts` | Open thread files/URLs in default apps |
| `capture_checkpoint` | Save a manual checkpoint with notes |
| `archive_thread` | Archive a completed thread |
| `split_thread` | Move selected events from a thread into a new standalone thread |
| `merge_threads` | Merge a source thread into a target; archives the source |
| `export_thread` | Serialize a thread to portable JSON for backup or sharing |
| `import_thread` | Import an exported thread JSON, remapping all IDs |

## Session Start Pattern

On session start, call `resume_last_thread` to surface what the user was working on.

## Commitment Tracking

Call `find_commitments` with `status: "open"` to surface pending work items.
Overdue commitments also appear in the `health` tool response under `alerts`.

## Safe Cleanup

`safe_clean_downloads` defaults to `dryRun: true`. Always preview before running
with `dryRun: false`. All moves are reversible via `undo_last_cleanup`.

## Thread Management

Use `split_thread` and `merge_threads` to reorganize threads that grew too broad
or that logically belong together. Use `export_thread` / `import_thread` to move
thread context across machines or share with teammates.

## Event Search

Use `search_events` to answer questions like "show all git commits this week" or
"what clipboard events did I have yesterday". Supports filtering by:
- `source` — e.g., `"git"`, `"clipboard"`, `"browser_history"`
- `kind` — e.g., `"commit"`, `"tab_opened"`, `"file_modified"`
- `threadId` — restrict to a specific thread
- `from` / `to` — ISO date strings
- `query` — free-text search against event title/content
