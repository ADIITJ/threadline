import type { Artifact, Commitment, Thread, ThreadlineEvent } from "@threadline/common";
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

interface ExportPayload {
  threadlineExport: boolean;
  version: number;
  thread: Thread;
  events: ThreadlineEvent[];
  artifacts: Artifact[];
  commitments: Commitment[];
}

export async function toolImportThread(
  input: { data: string },
  repos: Repos
): Promise<{ ok: boolean; threadId?: string; eventCount?: number; error?: string }> {
  if (!input.data) return { ok: false, error: "data is required" };

  let payload: ExportPayload;
  try {
    payload = JSON.parse(input.data) as ExportPayload;
  } catch {
    return { ok: false, error: "Invalid JSON data" };
  }

  if (!payload.threadlineExport || payload.version !== 1) {
    return {
      ok: false,
      error: "Not a valid Threadline export (expected threadlineExport: true, version: 1)",
    };
  }

  // Generate new IDs to avoid conflicts with existing data
  const idMap = new Map<string, string>();
  const remap = (oldId: string, prefix: string): string => {
    if (!idMap.has(oldId)) idMap.set(oldId, generateId(prefix));
    // biome-ignore lint/style/noNonNullAssertion: set above
    return idMap.get(oldId)!;
  };

  const newThreadId = remap(payload.thread.id, "th");

  repos.threads.upsert({
    ...payload.thread,
    id: newThreadId,
    title: `[imported] ${payload.thread.title}`,
  });

  let eventCount = 0;
  for (const ev of payload.events ?? []) {
    const newEvId = remap(ev.id, "ev");
    repos.events.insert({ ...ev, id: newEvId }, newThreadId);
    eventCount++;
  }

  for (const art of payload.artifacts ?? []) {
    const newArtId = remap(art.id, "art");
    repos.artifacts.upsert({ ...art, id: newArtId });
    repos.artifacts.linkToThread(newArtId, newThreadId);
  }

  for (const c of payload.commitments ?? []) {
    const newCId = remap(c.id, "cm");
    repos.commitments.insert({ ...c, id: newCId, threadId: newThreadId });
  }

  return { ok: true, threadId: newThreadId, eventCount };
}
