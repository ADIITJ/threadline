import type { Thread, ThreadlineEvent } from "@threadline/common";
import { ACTIVE_THREAD_HOURS, STALE_THREAD_DAYS } from "@threadline/common";

export type ThreadStateScore = {
  state: Thread["state"];
  score: number;
};

const BLOCKED_KEYWORDS = [
  "blocked",
  "waiting on",
  "waiting for",
  "pending review",
  "pending approval",
  "on hold",
];
const WAITING_KEYWORDS = [
  "reviewing",
  "review requested",
  "pr open",
  "submitted",
  "deployed",
  "sent to",
  "handed off",
];

export function scoreThreadState(
  thread: Thread,
  recentEvents: ThreadlineEvent[],
  nowMs: number = Date.now()
): ThreadStateScore {
  if (thread.state === "archived") {
    return { state: "archived", score: 0 };
  }

  const ageMs = nowMs - thread.lastSeenTs;
  const ageHours = ageMs / (60 * 60 * 1000);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  // Check for blocked signals in recent events
  const recentText = recentEvents
    .map((e) => `${e.title} ${e.text}`)
    .join(" ")
    .toLowerCase();

  for (const kw of BLOCKED_KEYWORDS) {
    if (recentText.includes(kw)) {
      return { state: "blocked", score: 0.3 };
    }
  }

  for (const kw of WAITING_KEYWORDS) {
    if (recentText.includes(kw)) {
      return { state: "waiting", score: 0.4 };
    }
  }

  if (ageHours <= ACTIVE_THREAD_HOURS) {
    const score = Math.max(0, 1.0 - ageHours / ACTIVE_THREAD_HOURS);
    return { state: "active", score };
  }

  if (ageDays >= STALE_THREAD_DAYS) {
    return { state: "stale", score: Math.max(0, 0.2 - (ageDays - STALE_THREAD_DAYS) / 30) };
  }

  // Between active and stale: waiting state
  const score = 0.5 * (1 - (ageHours - ACTIVE_THREAD_HOURS) / (STALE_THREAD_DAYS * 24));
  return { state: "waiting", score: Math.max(0, score) };
}
