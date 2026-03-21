# Threadline — Agent Guide

This document describes how AI agents should use Threadline tools.

## Setup

Threadline exposes tools via MCP. Register the server in your host's config
(see `examples/` directory). All tools work in tool-only mode — no resources
or prompts required.

## Session Start

At the start of every session, call `resume_last_thread` to surface the user's
most recent work context. Display the resume card immediately.

## Commitment Awareness

Call `find_commitments` with `{ "status": "open" }` when the user asks what
they need to do, what they promised, or what is pending.

## Context Lookup

When the user asks "why do I have this file open" or "what was this for",
call `explain_why_open` with the file path or URL.

## Cleanup

`safe_clean_downloads` defaults to dry-run mode. Always show the preview and
ask for confirmation before running with `dryRun: false`. Report the undo
token so the user can reverse if needed.

## Checkpoints

When the user says "save my progress", "I'm taking a break", or similar,
call `capture_checkpoint` with a title and any notes they provide.

## Handoff

When the user says "I need to hand this off" or "help me document my progress",
call `list_recent_threads` to identify the thread, then `prepare_handoff`.

## Project Overview

When the user says "show my projects", "what am I working on across repos",
or "group by project", call `list_projects` to show thread counts, active
threads, and open commitments per project.

## Automatic Context Sources

Threadline ingests context automatically from:
- **Filesystem & Git** — file changes, commits, branch switches
- **Clipboard** — copied text (secrets redacted, capped at 2000 chars)
- **Browser history** — Chrome, Brave, Firefox, Safari history databases
- **Claude Code sessions** — JSONL session files, project + branch context
- **Beads memory** — `~/.claude/projects/*/memory/*.md` on change
- **Claude tasks/plans** — `~/.claude/todos/` and `~/.claude/plans/` every 30s

No configuration required. All sources are enabled by default and can be
disabled individually in `~/.threadline/config.json`.

## Tool Reference

See `examples/AGENTS.md` for the full tool table and calling patterns.
