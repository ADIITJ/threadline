import { generateThreadSummary, generateThreadTitle } from "@threadline/engine-core";
import type { IStore } from "../storage/iStore.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

interface Repos {
  events: EventsRepo;
  threads: ThreadsRepo;
  artifacts: ArtifactsRepo;
  commitments: CommitmentsRepo;
  _store?: IStore;
}

export async function toolMergeThreads(
  input: { targetThreadId: string; sourceThreadId: string },
  repos: Repos
): Promise<{ ok: boolean; mergedEventCount?: number; error?: string }> {
  if (!input.targetThreadId || !input.sourceThreadId)
    return { ok: false, error: "targetThreadId and sourceThreadId are required" };
  if (input.targetThreadId === input.sourceThreadId)
    return { ok: false, error: "Cannot merge a thread into itself" };

  const target = repos.threads.findById(input.targetThreadId);
  const source = repos.threads.findById(input.sourceThreadId);
  if (!target) return { ok: false, error: `Target thread ${input.targetThreadId} not found` };
  if (!source) return { ok: false, error: `Source thread ${input.sourceThreadId} not found` };

  // Reassign events and artifact links to target thread
  repos.events.reassignThread(input.sourceThreadId, input.targetThreadId);
  repos.artifacts.relinkToThread(input.sourceThreadId, input.targetThreadId);

  // Reassign commitments' threadId directly through the store
  if (repos._store) {
    repos._store.updateWhere(
      "commitments",
      (r) => r.threadId === input.sourceThreadId,
      (r) => ({ ...r, threadId: input.targetThreadId })
    );
  }

  // Update target thread with merged metadata
  const allEvents = repos.events.findByThreadId(input.targetThreadId, 500);
  repos.threads.upsert({
    ...target,
    title: generateThreadTitle(allEvents),
    summary: generateThreadSummary(allEvents),
    lastSeenTs: Math.max(target.lastSeenTs, source.lastSeenTs),
    repoPaths: [...new Set([...target.repoPaths, ...source.repoPaths])],
    urls: [...new Set([...target.urls, ...source.urls])],
    entityBag: [...new Set([...target.entityBag, ...source.entityBag])],
  });

  repos.threads.updateState(input.sourceThreadId, "archived");

  return { ok: true, mergedEventCount: allEvents.length };
}
