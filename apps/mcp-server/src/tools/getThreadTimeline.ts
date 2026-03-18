import { z } from "zod";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { formatTs } from "../utils/dates.js";
import { truncate } from "../utils/text.js";

const InputSchema = z.object({
  threadId: z.string().min(1),
  limit: z.number().int().min(1).max(500).default(200),
});

export async function toolGetThreadTimeline(
  input: z.input<typeof InputSchema>,
  repos: { events: EventsRepo; threads: ThreadsRepo }
) {
  const { threadId, limit } = InputSchema.parse(input);

  const thread = repos.threads.findById(threadId);
  if (!thread) return { error: `Thread ${threadId} not found` };

  const events = repos.events.findByThreadId(threadId, limit);

  const formatted = events
    .map(
      (ev) =>
        `[${formatTs(ev.ts).slice(0, 19)}] ${ev.source}/${ev.kind} — ${truncate(ev.title || ev.url || ev.path || "", 80)}`
    )
    .join("\n");

  return {
    thread,
    events,
    formatted: `## Timeline: ${thread.title}\n\n${formatted || "No events recorded."}`,
  };
}
