import { existsSync } from "node:fs";
import { z } from "zod";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { openFile, openUrl } from "../utils/process.js";
import { isSafeUrl } from "../utils/urls.js";

const InputSchema = z.object({
  threadId: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(10),
});

export async function toolOpenThreadArtifacts(
  input: z.input<typeof InputSchema>,
  repos: { threads: ThreadsRepo; artifacts: ArtifactsRepo }
) {
  const { threadId, limit } = InputSchema.parse(input);

  const thread = repos.threads.findById(threadId);
  if (!thread) return { error: `Thread ${threadId} not found` };

  const artifacts = repos.artifacts.findByThreadId(threadId).slice(0, limit);
  const opened: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];

  for (const artifact of artifacts) {
    try {
      if (artifact.type === "file") {
        if (!existsSync(artifact.locator)) {
          skipped.push(artifact.locator);
          notes.push(`File not found: ${artifact.locator}`);
          continue;
        }
        openFile(artifact.locator);
        opened.push(artifact.locator);
      } else if (artifact.type === "url") {
        if (!isSafeUrl(artifact.locator)) {
          skipped.push(artifact.locator);
          notes.push(`Skipped unsafe URL: ${artifact.locator}`);
          continue;
        }
        openUrl(artifact.locator);
        opened.push(artifact.locator);
      } else {
        skipped.push(artifact.locator);
        notes.push(`Cannot open ${artifact.type}: ${artifact.locator}`);
      }
    } catch (err) {
      skipped.push(artifact.locator);
      notes.push(`Error opening ${artifact.locator}: ${String(err)}`);
    }
  }

  return { attempted: artifacts.length, opened, skipped, notes };
}
