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

## Tool Reference

See `examples/AGENTS.md` for the full tool table and calling patterns.
