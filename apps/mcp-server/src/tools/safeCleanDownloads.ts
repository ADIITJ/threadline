import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { CleanupManifest } from "@threadline/common";
import { z } from "zod";
import { logger } from "../logger.js";
import { writeAudit } from "../storage/auditLog.js";
import type { CleanupRepo } from "../storage/repositories/cleanupRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { generateId } from "../utils/hashing.js";

const InputSchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(500).default(50),
  olderThanDays: z.number().int().min(0).max(365).default(3),
  strategy: z.enum(["by_thread", "by_extension", "by_age"]).default("by_thread"),
});

interface FileCandidate {
  path: string;
  sizeBytes: number;
  ageDays: number;
  reason: string;
}

function hashFile(filePath: string): string {
  try {
    const MAX = 1024 * 1024;
    const stat = statSync(filePath);
    if (stat.size > MAX) return `size:${stat.size}`;
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  } catch {
    return "unknown";
  }
}

function getCandidates(
  downloadsDir: string,
  olderThanDays: number,
  limit: number
): FileCandidate[] {
  if (!existsSync(downloadsDir)) return [];

  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const results: FileCandidate[] = [];

  try {
    const entries = readdirSync(downloadsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = join(downloadsDir, entry.name);
      try {
        const stat = statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          const ageDays = Math.floor((Date.now() - stat.mtimeMs) / (24 * 60 * 60 * 1000));
          results.push({
            path: fullPath,
            sizeBytes: stat.size,
            ageDays,
            reason: `Not modified in ${ageDays} days`,
          });
        }
      } catch {
        continue;
      }
      if (results.length >= limit) break;
    }
  } catch {
    // ignore
  }

  return results;
}

export async function toolSafeCleanDownloads(
  input: z.input<typeof InputSchema>,
  homeDir: string,
  cleanupRepo: CleanupRepo,
  _threadsRepo: ThreadsRepo
) {
  const { dryRun, limit, olderThanDays } = InputSchema.parse(input);

  const downloadsDir = join(homedir(), "Downloads");
  const candidates = getCandidates(downloadsDir, olderThanDays, limit);

  if (dryRun) {
    return {
      manifestPreview: {
        candidateCount: candidates.length,
        totalBytes: candidates.reduce((s, c) => s + c.sizeBytes, 0),
        files: candidates,
      },
      movedCount: 0,
      quarantineDir: join(homeDir, "quarantine", "<pending>"),
      undoToken: "",
    };
  }

  const manifestId = generateId("cleanup");
  const quarantineDir = join(homeDir, "quarantine", manifestId);
  mkdirSync(quarantineDir, { recursive: true });

  const items: CleanupManifest["items"] = [];
  let movedCount = 0;

  for (const candidate of candidates) {
    const dest = join(quarantineDir, basename(candidate.path));
    try {
      const hash = hashFile(candidate.path);
      renameSync(candidate.path, dest);
      items.push({ from: candidate.path, to: dest, hash });
      movedCount++;
    } catch (err) {
      logger.warn(`Could not move ${candidate.path}`, err);
    }
  }

  const manifest: CleanupManifest = {
    id: manifestId,
    ts: Date.now(),
    sourceDir: downloadsDir,
    quarantineDir,
    items,
    reason: `Auto-cleanup: files older than ${olderThanDays} days`,
    restored: false,
  };

  cleanupRepo.insert(manifest);
  writeAudit({
    action: "cleanup_performed",
    actor: "user",
    subject: manifestId,
    details: { movedCount, quarantineDir },
  });

  return {
    manifest,
    movedCount,
    quarantineDir,
    undoToken: manifestId,
  };
}
