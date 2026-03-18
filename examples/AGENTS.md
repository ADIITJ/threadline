# Threadline — Agent Tool Reference

Threadline exposes 14 MCP tools. All tools are available via tool-calling —
no resources or prompts required.

## Tool Summary

| Tool | Purpose |
|------|---------|
| `health` | Verify daemon is running and collectors are active |
| `list_recent_threads` | List work threads by recency |
| `get_thread_details` | Get full detail for a thread by ID |
| `get_thread_timeline` | Get chronological events for a thread |
| `resume_last_thread` | Build a resume card for the most recent thread |
| `search_threads` | Search thread titles, summaries, and events |
| `find_commitments` | Find open/done commitments across threads |
| `prepare_handoff` | Generate a handoff document for a thread |
| `safe_clean_downloads` | Preview or clean the Downloads folder |
| `undo_last_cleanup` | Restore the most recent cleanup |
| `explain_why_open` | Explain why a file/URL is in context |
| `open_thread_artifacts` | Open thread files/URLs in default apps |
| `capture_checkpoint` | Save a manual checkpoint with notes |
| `archive_thread` | Archive a completed thread |

## Session Start Pattern

On session start, call `resume_last_thread` to surface what the user was working on.

## Commitment Tracking

Call `find_commitments` with `status: "open"` to surface pending work items.

## Safe Cleanup

`safe_clean_downloads` defaults to `dryRun: true`. Always preview before running
with `dryRun: false`. All moves are reversible via `undo_last_cleanup`.
