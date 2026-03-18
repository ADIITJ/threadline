import type { Thread } from "@threadline/common";
import { z } from "zod";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { formatRelative } from "../utils/dates.js";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  state: z.enum(["active", "waiting", "blocked", "stale", "archived"]).optional(),
});

export async function toolListRecentThreads(
  input: z.input<typeof InputSchema>,
  repos: {
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
  }
) {
  const { limit, state } = InputSchema.parse(input);
  const threads = repos.threads.findRecent(limit, state);

  const enriched = threads.map((t) => ({
    id: t.id,
    title: t.title,
    state: t.state,
    lastSeenTs: t.lastSeenTs,
    lastSeenRelative: formatRelative(t.lastSeenTs),
    summary: t.summary,
    artifactCount: repos.artifacts.countByThread(t.id),
    commitmentCount: repos.commitments.countByThread(t.id),
    score: Math.round(t.score * 100) / 100,
  }));

  const text = formatThreadList(enriched);

  return { threads: enriched, formatted: text };
}

function formatThreadList(
  threads: ReturnType<typeof toolListRecentThreads> extends Promise<infer T>
    ? T extends { threads: infer U }
      ? U
      : never
    : never
): string {
  if (threads.length === 0) return "No threads found.";
  const lines = ["## Recent Threads\n"];
  for (const t of threads) {
    lines.push(`**[${t.state.toUpperCase()}]** ${t.title}`);
    lines.push(
      `  ID: \`${t.id}\` | Last active: ${t.lastSeenRelative} | Artifacts: ${t.artifactCount} | Commitments: ${t.commitmentCount}`
    );
    if (t.summary) lines.push(`  > ${t.summary}`);
    lines.push("");
  }
  return lines.join("\n");
}
