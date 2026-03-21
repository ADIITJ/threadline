import { THREADLINE_VERSION } from "@threadline/common";
import { getAll as getCollectorStats } from "../storage/collectorRegistry.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import type { ThreadlineConfig } from "../types.js";
import { formatRelative } from "../utils/dates.js";

export async function toolHealth(
  _input: Record<string, never>,
  config: ThreadlineConfig,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  }
) {
  const collectorSummary = Object.entries(getCollectorStats()).map(([name, s]) => ({
    name,
    enabled: s.enabled,
    eventCount: s.eventCount,
    lastEvent: s.lastEventTs ? formatRelative(s.lastEventTs) : "never",
    lastError: s.lastError ?? null,
    ...s.details,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const dueToday = repos.commitments
    .findAll({ status: "open" })
    .filter((c) => c.dueDate != null && c.dueDate <= today);

  return {
    ok: true,
    version: THREADLINE_VERSION,
    threadlineHome: config.homeDir,
    schemaVersion: 3,
    collectors: collectorSummary,
    recentCounts: {
      events: repos.events.countTotal(),
      threads: repos.threads.countTotal(),
      commitments: repos.commitments.countTotal(),
      checkpoints: repos.checkpoints.countTotal(),
    },
    alerts: dueToday.map((c) => ({
      type: "commitment_due",
      text: c.text,
      dueDate: c.dueDate,
      threadId: c.threadId,
    })),
  };
}
