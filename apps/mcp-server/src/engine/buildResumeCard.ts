import type { Artifact, Commitment, Thread } from "@threadline/common";
import { formatRelative } from "../utils/dates.js";
import { truncate } from "../utils/text.js";

export function buildResumeCard(
  thread: Thread,
  commitments: Commitment[],
  artifacts: Artifact[],
  recentEventTitles: string[]
): string {
  const lines: string[] = [];
  lines.push(`## ${thread.title}`);
  lines.push(`**State:** ${thread.state} | **Last active:** ${formatRelative(thread.lastSeenTs)}`);
  lines.push("");

  if (thread.summary) {
    lines.push(`> ${thread.summary}`);
    lines.push("");
  }

  if (recentEventTitles.length > 0) {
    lines.push("**Recent activity:**");
    for (const title of recentEventTitles.slice(0, 5)) {
      if (title) lines.push(`- ${truncate(title, 80)}`);
    }
    lines.push("");
  }

  const openCommitments = commitments.filter((c) => c.status === "open");
  if (openCommitments.length > 0) {
    lines.push("**Open commitments:**");
    for (const c of openCommitments.slice(0, 5)) {
      const due = c.dueDate ? ` (due ${c.dueDate})` : "";
      lines.push(`- [ ] ${truncate(c.text, 100)}${due}`);
    }
    lines.push("");
  }

  if (artifacts.length > 0) {
    lines.push("**Key artifacts:**");
    for (const a of artifacts.slice(0, 5)) {
      lines.push(`- \`${truncate(a.locator, 80)}\` (${a.type})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildSuggestedActions(thread: Thread, commitments: Commitment[]): string[] {
  const actions: string[] = [];

  if (thread.state === "stale") {
    actions.push(
      "Resume this thread — it has been inactive. Review recent artifacts and pick up where you left off."
    );
  }
  if (thread.state === "blocked") {
    actions.push("Check if the blocker has been resolved before continuing.");
  }

  const open = commitments.filter((c) => c.status === "open");
  if (open.length > 0) {
    actions.push(`Follow up on ${open.length} open commitment(s).`);
  }

  if (thread.repoPaths.length > 0) {
    actions.push(`Open repo: ${thread.repoPaths[0]}`);
  }

  if (thread.urls.length > 0) {
    actions.push(`Review linked resources (${thread.urls.length} URL(s)).`);
  }

  return actions;
}
