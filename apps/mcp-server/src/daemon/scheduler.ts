import { scoreThreadState } from "@threadline/engine-core";
import { clusterNewEvents } from "../engine/clusterThreads.js";
import { logger } from "../logger.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const CLUSTER_INTERVAL_MS = 5 * 60 * 1000;
const STATE_SCORE_INTERVAL_MS = 15 * 60 * 1000;
const COMMITMENT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

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

  // Proactive commitment due-date alerts (Issue 4)
  const commitmentCheckInterval = setInterval(() => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueSoon = repos.commitments.findAll({
        status: "open",
        dueBefore: tomorrow.toISOString().slice(0, 10),
      });
      if (dueSoon.length > 0) {
        logger.warn(`[Threadline] ${dueSoon.length} commitment(s) due within 24 hours`, {
          commitments: dueSoon.map((c) => ({
            text: c.text,
            dueDate: c.dueDate,
            threadId: c.threadId,
          })),
        });
      }
    } catch (err) {
      logger.warn("Scheduler commitment check error", err);
    }
  }, COMMITMENT_CHECK_INTERVAL_MS);

  // Run commitment check immediately on startup
  setTimeout(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const overdue = repos.commitments.findAll({ status: "open", dueBefore: today });
      if (overdue.length > 0) {
        logger.warn(`[Threadline] ${overdue.length} overdue commitment(s)`, {
          commitments: overdue.map((c) => ({ text: c.text, dueDate: c.dueDate })),
        });
      }
    } catch {
      // ignore
    }
  }, 5000);

  return () => {
    clearInterval(clusterInterval);
    clearInterval(scoreInterval);
    clearInterval(commitmentCheckInterval);
  };
}

/**
 * Auto-close commitments matching a git commit message (Issue 5).
 * Called from ingestEvent when a "committed" event fires.
 * Uses simple case-insensitive substring matching.
 */
export function autoCloseMatchingCommitments(
  commitMsg: string,
  threadId: string | null,
  repos: { commitments: CommitmentsRepo }
): number {
  if (!commitMsg) return 0;
  const msgLower = commitMsg.toLowerCase();
  const openCommitments = repos.commitments.findAll({
    status: "open",
    ...(threadId ? { threadId } : {}),
  });

  let closed = 0;
  for (const c of openCommitments) {
    const textLower = c.text.toLowerCase();
    // Match if commit message contains key words from the commitment text
    const words = textLower.split(/\s+/).filter((w) => w.length > 4);
    const matchCount = words.filter((w) => msgLower.includes(w)).length;
    const matchRatio = words.length > 0 ? matchCount / words.length : 0;
    if (matchRatio >= 0.5) {
      repos.commitments.updateStatus(c.id, "done");
      closed++;
      logger.info(
        `Auto-closed commitment: "${c.text.slice(0, 60)}" via commit "${commitMsg.slice(0, 60)}"`
      );
    }
  }
  return closed;
}
