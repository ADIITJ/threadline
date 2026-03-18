import { z } from "zod";
import { createCheckpoint } from "../collectors/manualCheckpoint.js";
import { clusterNewEvents } from "../engine/clusterThreads.js";
import { writeAudit } from "../storage/auditLog.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const InputSchema = z.object({
  title: z.string().min(1).max(200),
  note: z.string().max(2000).optional(),
  paths: z.array(z.string()).max(20).optional(),
  urls: z.array(z.string()).max(20).optional(),
});

export async function toolCaptureCheckpoint(
  input: z.input<typeof InputSchema>,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  }
) {
  const { title, note, paths, urls } = InputSchema.parse(input);

  // Try to find a recently-active thread to attach to
  const recent = repos.threads.findRecent(1, "active");
  const threadId = recent[0]?.id;

  const result = await createCheckpoint(
    { title, note, paths, urls },
    repos.events,
    repos.checkpoints,
    repos.commitments,
    threadId
  );

  writeAudit({
    action: "checkpoint_created",
    actor: "user",
    subject: result.checkpoint.id,
    details: { title },
  });

  await clusterNewEvents([result.event], repos.events, repos.threads, repos.artifacts);

  const linkedThread = threadId ? repos.threads.findById(threadId) : null;

  return {
    checkpoint: result.checkpoint,
    linkedThread,
    extractedCommitments: result.commitments,
  };
}
