import { CheckpointPayloadSchema } from "@threadline/common";
import type { FastifyInstance } from "fastify";
import { createCheckpoint } from "../collectors/manualCheckpoint.js";
import { clusterNewEvents } from "../engine/clusterThreads.js";
import { writeAudit } from "../storage/auditLog.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import type { ThreadlineConfig } from "../types.js";

export function registerIngestRoutes(
  app: FastifyInstance,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  },
  _config: ThreadlineConfig
): void {
  app.post("/ingest/checkpoint", async (req, reply) => {
    const parsed = CheckpointPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const result = await createCheckpoint(
      parsed.data,
      repos.events,
      repos.checkpoints,
      repos.commitments
    );

    writeAudit({
      action: "checkpoint_created",
      actor: "user",
      subject: result.checkpoint.id,
      details: { title: parsed.data.title },
    });

    await clusterNewEvents([result.event], repos.events, repos.threads, repos.artifacts);

    return reply.status(201).send({
      checkpoint: result.checkpoint,
      commitments: result.commitments,
    });
  });
}
