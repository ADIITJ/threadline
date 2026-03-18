import { scoreThreadState } from "@threadline/engine-core";
import { clusterNewEvents } from "../engine/clusterThreads.js";
import { logger } from "../logger.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const CLUSTER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const STATE_SCORE_INTERVAL_MS = 15 * 60 * 1000; // every 15 min

export function startScheduler(repos: {
  events: EventsRepo;
  threads: ThreadsRepo;
  artifacts: ArtifactsRepo;
  commitments: CommitmentsRepo;
}): () => void {
  const clusterInterval = setInterval(async () => {
    try {
      const unassigned = repos.events.findUnassigned(200);
      if (unassigned.length > 0) {
        await clusterNewEvents(unassigned, repos.events, repos.threads, repos.artifacts);
        logger.debug(`Clustered ${unassigned.length} unassigned events`);
      }
    } catch (err) {
      logger.warn("Scheduler cluster error", err);
    }
  }, CLUSTER_INTERVAL_MS);

  const scoreInterval = setInterval(() => {
    try {
      const threads = repos.threads.findAll(500);
      for (const thread of threads) {
        if (thread.state === "archived") continue;
        const recentEvents = repos.events.findByThreadId(thread.id, 10);
        const { state, score } = scoreThreadState(thread, recentEvents);
        if (state !== thread.state || Math.abs(score - thread.score) > 0.05) {
          repos.threads.upsert({ ...thread, state, score });
        }
      }
    } catch (err) {
      logger.warn("Scheduler score error", err);
    }
  }, STATE_SCORE_INTERVAL_MS);

  return () => {
    clearInterval(clusterInterval);
    clearInterval(scoreInterval);
  };
}
