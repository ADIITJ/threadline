# Auto-Trigger Rules

Threadline tools should be invoked automatically when the user's message matches these patterns.

## Resume / continue work

Trigger `resume_last_thread` when user says:
- "resume", "continue", "pick up where I left off"
- "what was I working on", "what was the last thing I did"
- "get me back up to speed"
- "I just opened a new terminal / new session, what was I doing"

## List threads / history

Trigger `list_recent_threads` when user says:
- "show my threads", "show recent work", "show history"
- "what have I been working on", "show me my sessions"

## Find commitments

Trigger `find_commitments` when user says:
- "what did I promise", "what are my action items"
- "show commitments", "find open tasks"
- "what do I owe someone"

## Explain a file or URL

Trigger `explain_why_open` when user says:
- "why is [file/URL] open", "what is this [file] for"
- "why do I have [URL] open", "explain [file]"
- "should I close this tab"

## Handoff

Trigger `prepare_handoff` when user says:
- "prepare handoff", "summarize my work for a colleague"
- "I'm done for the day, what should I document"
- "handoff summary"

## Safe cleanup

Trigger `safe_clean_downloads(dryRun=true)` when user says:
- "clean my downloads", "what can I delete from downloads"
- "my downloads folder is a mess"

Always dry-run first and ask for confirmation before actual move.

## Checkpoint

Trigger `capture_checkpoint` when user says:
- "save my progress", "checkpoint", "mark where I am"
- "I'm pausing this, save context"
