import type { Commitment, ThreadlineEvent } from "@threadline/common";
import { extractCommitmentsFromText } from "@threadline/engine-core";
import { generateId, shortHash } from "../utils/hashing.js";

export function extractCommitmentsFromEvents(
  events: ThreadlineEvent[],
  threadId: string
): Commitment[] {
  const all: Commitment[] = [];
  const seen = new Set<string>();

  for (const ev of events) {
    const texts = [ev.title, ev.text].filter(Boolean) as string[];
    for (const text of texts) {
      const extracted = extractCommitmentsFromText(text, ev.actor || "user");
      for (const c of extracted) {
        const key = shortHash(c.text);
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          id: generateId("cm"),
          threadId,
          text: c.text,
          owner: c.owner,
          dueDate: c.dueDate,
          status: "open",
          evidenceEventIds: [ev.id],
          confidence: c.confidence,
          metadata: {},
        });
      }
    }
  }

  return all;
}
