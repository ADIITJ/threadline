/**
 * Move a file to the Threadline quarantine directory with a manifest entry.
 * All moves are reversible via undo_last_cleanup.
 *
 * Usage: npx ts-node skills/threadline/scripts/safe_quarantine_move.ts <file-path>
 */
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureHomeDirs, loadConfig } from "../../../apps/mcp-server/src/config.js";
import { isPathAllowed } from "../../../apps/mcp-server/src/security/pathSafety.js";
import { getDb } from "../../../apps/mcp-server/src/storage/db.js";
import { CleanupRepo } from "../../../apps/mcp-server/src/storage/repositories/cleanupRepo.js";
import { nowMs } from "../../../apps/mcp-server/src/utils/dates.js";
import { safeContentHash } from "../../../apps/mcp-server/src/utils/fs.js";
import { generateId } from "../../../apps/mcp-server/src/utils/hashing.js";

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: safe_quarantine_move.ts <file-path>");
    process.exit(1);
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const config = loadConfig();
  ensureHomeDirs(config);

  if (!isPathAllowed(filePath, config.allowPaths)) {
    console.error(`Path not in allowlist: ${filePath}`);
    process.exit(1);
  }

  const db = getDb(config.homeDir);
  const cleanupRepo = new CleanupRepo(db);

  const manifestId = generateId();
  const quarantineDir = join(config.homeDir, "quarantine", manifestId);
  mkdirSync(quarantineDir, { recursive: true });

  const stat = statSync(filePath);
  const destPath = join(quarantineDir, basename(filePath));
  const hash = await safeContentHash(filePath);

  renameSync(filePath, destPath);

  cleanupRepo.insert({
    id: manifestId,
    createdAt: nowMs(),
    restoredAt: null,
    items: JSON.stringify([
      {
        originalPath: filePath,
        quarantinePath: destPath,
        sizeBytes: stat.size,
        hash,
        movedAt: nowMs(),
      },
    ]),
  });

  console.log(`Moved to quarantine: ${destPath}`);
  console.log(`Manifest ID: ${manifestId}`);
  console.log(`Run 'undo_last_cleanup' tool to restore.`);
}

main().catch((err) => {
  console.error("safe_quarantine_move failed:", err);
  process.exit(1);
});
