import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

interface Repos {
  events: EventsRepo;
  threads: ThreadsRepo;
  artifacts: ArtifactsRepo;
  commitments: CommitmentsRepo;
}

export async function toolExportThread(
  input: { threadId: string },
  repos: Repos
): Promise<{ ok: boolean; export?: string; error?: string }> {
  if (!input.threadId) return { ok: false, error: "threadId is required" };

  const thread = repos.threads.findById(input.threadId);
  if (!thread) return { ok: false, error: `Thread ${input.threadId} not found` };

  const events = repos.events.findByThreadId(input.threadId, 500);
  const artifacts = repos.artifacts.findByThreadId(input.threadId);
  const commitments = repos.commitments.findAll({ threadId: input.threadId });

  const payload = {
    threadlineExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    thread,
    events,
    artifacts,
    commitments,
  };

  return { ok: true, export: JSON.stringify(payload, null, 2) };
}
