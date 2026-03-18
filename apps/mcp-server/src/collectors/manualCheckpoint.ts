import type { Checkpoint, ThreadlineEvent } from "@threadline/common";
import type { CheckpointPayload } from "@threadline/common";
import type { Commitment } from "@threadline/common";
import { extractCommitmentsFromText } from "@threadline/engine-core";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import { generateId } from "../utils/hashing.js";
import { extractEntities } from "../utils/text.js";

export async function createCheckpoint(
  payload: CheckpointPayload,
  eventsRepo: EventsRepo,
  checkpointsRepo: CheckpointsRepo,
  commitmentsRepo: CommitmentsRepo,
  threadId?: string
): Promise<{ checkpoint: Checkpoint; event: ThreadlineEvent; commitments: Commitment[] }> {
  const ts = Date.now();
  const cpId = generateId("cp");

  const checkpoint: Checkpoint = {
    id: cpId,
    threadId,
    ts,
    title: payload.title,
    note: payload.note ?? "",
    artifactIds: [],
    metadata: {
      paths: payload.paths ?? [],
      urls: payload.urls ?? [],
    },
  };

  checkpointsRepo.insert(checkpoint);

  const event: ThreadlineEvent = {
    id: generateId("ev"),
    ts,
    source: "checkpoint",
    kind: "checkpoint_created",
    actor: "user",
    title: payload.title,
    text: payload.note ?? "",
    tags: [],
    entities: extractEntities(`${payload.title} ${payload.note ?? ""}`),
    metadata: { checkpointId: cpId },
  };

  eventsRepo.insert(event, threadId);

  // Extract commitments from checkpoint note
  const extracted = extractCommitmentsFromText(`${payload.title} ${payload.note ?? ""}`, "user");
  const commitments: Commitment[] = extracted.map((c) => ({
    id: generateId("cm"),
    threadId: threadId ?? "",
    text: c.text,
    owner: c.owner,
    dueDate: c.dueDate,
    status: "open" as const,
    evidenceEventIds: [event.id],
    confidence: c.confidence,
    metadata: {},
  }));

  for (const c of commitments) {
    if (c.threadId) {
      commitmentsRepo.insert(c);
    }
  }

  return { checkpoint, event, commitments };
}
