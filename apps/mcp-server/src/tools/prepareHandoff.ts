import { z } from "zod";
import { buildHandoff } from "../engine/buildHandoff.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "../storage/searchIndex.js";

const InputSchema = z.object({
  threadId: z.string().optional(),
  query: z.string().optional(),
  includeArtifacts: z.boolean().default(true),
});

export async function toolPrepareHandoff(
  input: z.input<typeof InputSchema>,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
  }
) {
  const { threadId, query, includeArtifacts } = InputSchema.parse(input);

  let thread = null;

  if (threadId) {
    thread = repos.threads.findById(threadId);
    if (!thread) return { error: `Thread ${threadId} not found` };
  } else if (query) {
    const results = globalSearchIndex.search(query, 3);
    for (const r of results) {
      const t = repos.threads.findById(r.id);
      if (t && t.state !== "archived") {
        thread = t;
        break;
      }
    }
  }

  if (!thread) {
    const recent = repos.threads.findRecent(1);
    thread = recent[0] ?? null;
  }

  if (!thread) return { error: "No threads found" };

  const events = repos.events.findByThreadId(thread.id, 50);
  const commitments = repos.commitments.findByThreadId(thread.id);
  const artifacts = includeArtifacts ? repos.artifacts.findByThreadId(thread.id) : [];

  return buildHandoff(thread, events, commitments, artifacts);
}
