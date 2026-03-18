import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { logger } from "../logger.js";
import { writeAudit } from "../storage/auditLog.js";
import type { CleanupRepo } from "../storage/repositories/cleanupRepo.js";

export async function toolUndoLastCleanup(_input: Record<string, never>, cleanupRepo: CleanupRepo) {
  const manifest = cleanupRepo.findLatestUnrestored();

  if (!manifest) {
    return {
      restored: false,
      restoredCount: 0,
      conflicts: [],
      manifest: null,
    };
  }

  const conflicts: string[] = [];
  let restoredCount = 0;

  for (const item of manifest.items) {
    try {
      if (!existsSync(item.to)) {
        conflicts.push(`Quarantined file missing: ${item.to}`);
        continue;
      }

      if (existsSync(item.from)) {
        // Conflict: original path occupied
        const conflictPath = item.from.replace(/(\.[^.]+)?$/, `_restored_${Date.now()}$1`);
        renameSync(item.to, conflictPath);
        conflicts.push(`Restored to ${conflictPath} (original ${item.from} was occupied)`);
      } else {
        const dir = dirname(item.from);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        renameSync(item.to, item.from);
      }
      restoredCount++;
    } catch (err) {
      logger.warn(`Could not restore ${item.from}`, err);
      conflicts.push(`Failed to restore ${item.from}: ${String(err)}`);
    }
  }

  cleanupRepo.markRestored(manifest.id);
  writeAudit({
    action: "cleanup_undone",
    actor: "user",
    subject: manifest.id,
    details: { restoredCount, conflicts: conflicts.length },
  });

  return {
    restored: restoredCount > 0,
    restoredCount,
    conflicts,
    manifest: { ...manifest, restored: true },
  };
}
