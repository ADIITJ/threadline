import type { Thread } from "@threadline/common";
import { generateThreadSummary, generateThreadTitle } from "@threadline/engine-core";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { generateId } from "../utils/hashing.js";

interface Repos {
  events: EventsRepo;
  threads: ThreadsRepo;
  artifacts: ArtifactsRepo;
  commitments: CommitmentsRepo;
}

export async function toolSplitThread(
  input: { threadId: string; eventIds: string[] },
  repos: Repos
): Promise<{ ok: boolean; newThreadId?: string; error?: string }> {
  if (!input.threadId) return { ok: false, error: "threadId is required" };
  if (!input.eventIds?.length) return { ok: false, error: "eventIds must be non-empty" };

  const thread = repos.threads.findById(input.threadId);
  if (!thread) return { ok: false, error: `Thread ${input.threadId} not found` };

  const eventIdSet = new Set(input.eventIds);
  const splitEvents = repos.events
    .findByThreadId(input.threadId, 500)
    .filter((e) => eventIdSet.has(e.id));

  if (splitEvents.length === 0) return { ok: false, error: "No matching events found in thread" };

  const newThreadId = generateId("th");
  const newThread: Thread = {
    id: newThreadId,
    title: generateThreadTitle(splitEvents),
    summary: generateThreadSummary(splitEvents),
    state: "active",
    firstSeenTs: Math.min(...splitEvents.map((e) => e.ts)),
    lastSeenTs: Math.max(...splitEvents.map((e) => e.ts)),
    score: 0.5,
    signature: thread.signature,
    entityBag: thread.entityBag,
    artifactIds: [],
    repoPaths: [...new Set(splitEvents.filter((e) => e.repoPath).map((e) => e.repoPath as string))],
    urls: [...new Set(splitEvents.filter((e) => e.url).map((e) => e.url as string))],
    checkpointIds: [],
    metadata: {},
  };
  repos.threads.upsert(newThread);

  // Reassign the split events to the new thread
  for (const ev of splitEvents) {
    repos.events.updateThreadId(ev.id, newThreadId);
  }

  return { ok: true, newThreadId };
}
