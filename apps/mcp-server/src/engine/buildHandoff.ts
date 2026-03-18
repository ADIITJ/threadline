import type { Artifact, Commitment, Thread, ThreadlineEvent } from "@threadline/common";
import type { HandoffDoc } from "../types.js";
import { formatTs } from "../utils/dates.js";
import { truncate } from "../utils/text.js";

export function buildHandoff(
  thread: Thread,
  events: ThreadlineEvent[],
  commitments: Commitment[],
  artifacts: Artifact[]
): HandoffDoc {
  const openCommitments = commitments.filter((c) => c.status === "open");
  const openQuestions = extractOpenQuestions(events);
  const nextSteps = buildNextSteps(thread, openCommitments, artifacts);

  const executiveSummary = buildExecutiveSummary(thread, events, openCommitments, artifacts);

  return {
    title: `Handoff: ${thread.title}`,
    executiveSummary,
    timeline: events.slice(0, 30),
    openQuestions,
    commitments: openCommitments,
    artifacts: artifacts.slice(0, 10),
    nextSteps,
  };
}

function buildExecutiveSummary(
  thread: Thread,
  events: ThreadlineEvent[],
  commitments: Commitment[],
  artifacts: Artifact[]
): string {
  const parts: string[] = [];
  parts.push(
    `This thread covers "${thread.title}" with ${events.length} recorded events and ${artifacts.length} artifacts.`
  );
  if (commitments.length > 0) {
    parts.push(`There are ${commitments.length} open commitment(s) pending.`);
  }
  if (thread.repoPaths.length > 0) {
    parts.push(`Primary repo: ${thread.repoPaths[0]}`);
  }
  if (thread.summary) {
    parts.push(thread.summary);
  }
  return parts.join(" ");
}

function extractOpenQuestions(events: ThreadlineEvent[]): string[] {
  const questions: string[] = [];
  const questionRe = /[^.!?]*\?/g;
  for (const ev of events.slice(0, 20)) {
    const text = `${ev.title} ${ev.text}`;
    const matches = text.match(questionRe) ?? [];
    for (const m of matches) {
      const q = m.trim();
      if (q.length > 10 && q.length < 200) {
        questions.push(q);
      }
    }
  }
  return [...new Set(questions)].slice(0, 5);
}

function buildNextSteps(
  thread: Thread,
  commitments: Commitment[],
  artifacts: Artifact[]
): string[] {
  const steps: string[] = [];
  for (const c of commitments.slice(0, 3)) {
    steps.push(`Complete: ${truncate(c.text, 100)}`);
  }
  if (thread.repoPaths.length > 0) {
    steps.push(`Review code in ${thread.repoPaths[0]}`);
  }
  if (artifacts.some((a) => a.type === "url")) {
    steps.push("Check linked resources and close resolved tabs");
  }
  return steps;
}
