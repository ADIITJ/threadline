# Privacy Model

## Core guarantees

1. **Local only by default.** All data is stored in `~/.threadline/` on the user's machine.
   No network requests are made to any external service for core functionality.

2. **No keylogging.** Threadline does not capture keystrokes or record continuous input.
   It only observes file system events, git metadata, clipboard text (at rest), and browser
   tab metadata.

3. **Incognito ignored.** Browser events from private/incognito sessions are ignored by
   default (`ignorePrivateBrowser: true` in config).

4. **Secret redaction.** Before persisting clipboard text, event titles, or notes,
   Threadline applies a heuristic redaction pass for likely secrets:
   - API keys (sk-, ghp_, AKIA..., Bearer tokens)
   - High-entropy base64 strings
   - Passwords and secret patterns
   Redacted content is replaced with `[REDACTED_TOKEN]`.

5. **Explicit path allowlist.** Filesystem watching is restricted to explicitly allowlisted
   paths. By default: Desktop, Downloads, Documents. No other paths are watched unless
   the user adds them to `allowPaths` in config.

6. **Destructive actions are reversible.** `safe_clean_downloads` moves files to a
   quarantine directory with a full manifest. Files can be restored with `undo_last_cleanup`.
   Nothing is permanently deleted by Threadline.

7. **Audit log.** All writes are logged to `~/.threadline/audit/events.jsonl` in append-only
   format so the user can inspect what Threadline has done.

## Data stored

- File creation/modification/deletion events (path, timestamp, hash of small text files)
- Git branch changes and commit metadata (author, message, hash — not file diffs)
- Clipboard text (capped at `maxStoredClipboardChars`, redacted)
- Browser tab metadata (URL, title, timestamp — not page content)
- Manual checkpoints (user-provided title and notes)
- Active window title (if enabled — disabled by default)

## Data NOT stored

- File contents (except small text files for hashing)
- Browser page HTML or content
- Keystrokes
- Screen recordings
- Network traffic
- Login credentials
