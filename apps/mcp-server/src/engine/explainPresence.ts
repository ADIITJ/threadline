import type { Artifact, Thread, ThreadlineEvent } from "@threadline/common";
import { formatRelative } from "../utils/dates.js";

export function explainPresence(
  locator: string,
  thread: Thread | null,
  events: ThreadlineEvent[],
  artifacts: Artifact[]
): string {
  const lines: string[] = [];

  if (!thread) {
    lines.push(`No thread found for \`${locator}\`.`);
    if (events.length > 0) {
      lines.push(
        `Seen in ${events.length} event(s), most recently ${formatRelative(events[0].ts)}.`
      );
    } else {
      lines.push("No events found referencing this path or URL.");
    }
    return lines.join("\n");
  }

  lines.push(`**${locator}** is part of thread: **${thread.title}**`);
  lines.push(`Thread state: ${thread.state} | Last active: ${formatRelative(thread.lastSeenTs)}`);
  lines.push("");

  if (events.length > 0) {
    lines.push(`**Why it's still open:**`);
    for (const ev of events.slice(0, 3)) {
      lines.push(`- [${formatRelative(ev.ts)}] ${ev.kind}: ${ev.title || locator}`);
    }
    lines.push("");
  }

  const matching = artifacts.filter((a) => a.locator === locator);
  if (matching.length > 0) {
    const art = matching[0];
    lines.push(
      `First seen ${formatRelative(art.firstSeenTs)}, last seen ${formatRelative(art.lastSeenTs)}.`
    );
  }

  return lines.join("\n");
}
