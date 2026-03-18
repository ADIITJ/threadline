# Cleanup Policies

## Safe cleanup principles

1. **Never permanently delete.** Files are always moved to a quarantine directory, never
   deleted. Quarantine is at `~/.threadline/quarantine/<manifest-id>/`.

2. **Full manifest.** Every cleanup operation records a manifest with original paths and
   file hashes. The manifest is stored in the database and can be retrieved with
   `undo_last_cleanup`.

3. **Dry-run by default.** The `safe_clean_downloads` tool defaults to `dryRun: true`.
   Always preview before performing actual moves.

4. **Conflict resolution.** When undoing cleanup, if the original path is already occupied,
   the restored file gets a `_restored_<timestamp>` suffix. Conflicts are reported to the
   user.

## Default cleanup strategy

By default, candidates are files in `~/Downloads` older than 3 days (configurable via
`downloadCleanupThreshold` in config). Files are grouped by their thread association
when available, otherwise by age.

## Cleanup configuration

```json
{
  "downloadCleanupThreshold": 3,
  "allowPaths": ["/Users/username/Downloads"]
}
```

## Quarantine structure

```
~/.threadline/
  quarantine/
    <manifest-id>/
      file1.pdf
      screenshot.png
      ...
```

## Undo

Run `undo_last_cleanup` to restore the most recent unrestored cleanup manifest.
Multiple cleanups can be undone by running the tool multiple times (each call
restores one manifest).
