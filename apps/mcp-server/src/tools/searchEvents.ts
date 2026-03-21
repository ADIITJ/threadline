import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { formatRelative } from "../utils/dates.js";

interface Repos {
  events: EventsRepo;
  threads: ThreadsRepo;
}

export async function toolSearchEvents(
  input: {
    query?: string;
    source?: string;
    kind?: string;
    threadId?: string;
    sinceTs?: number;
    untilTs?: number;
    limit?: number;
  },
  repos: Repos
): Promise<{ events: unknown[]; formatted: string; total: number }> {
  const events = repos.events.findFiltered({
    query: input.query,
    source: input.source,
    kind: input.kind,
    threadId: input.threadId,
    sinceTs: input.sinceTs,
    untilTs: input.untilTs,
    limit: input.limit ?? 50,
  });

  if (events.length === 0) {
    return { events: [], formatted: "No events matched.", total: 0 };
  }

  // Enrich with thread title
  const threadCache = new Map<string, string>();
  const getThreadTitle = (tid: string | undefined) => {
    if (!tid) return "unassigned";
    if (!threadCache.has(tid)) {
      const t = repos.threads.findById(tid);
      threadCache.set(tid, t?.title ?? tid.slice(0, 8));
    }
    // biome-ignore lint/style/noNonNullAssertion: set above
    return threadCache.get(tid)!;
  };

  const lines = [`## Event Search${input.query ? ` — "${input.query}"` : ""}\n`];
  for (const ev of events) {
    const tid = (ev as unknown as Record<string, unknown>).__threadId as string | undefined;
    const rel = formatRelative(ev.ts);
    lines.push(
      `- **[${ev.source}/${ev.kind}]** ${ev.title}  ·  ${rel}  ·  thread: ${getThreadTitle(tid)}`
    );
    if (ev.path) lines.push(`  \`${ev.path}\``);
    if (ev.url) lines.push(`  ${ev.url}`);
  }

  return {
    events: events.map((ev) => ({
      id: ev.id,
      ts: ev.ts,
      source: ev.source,
      kind: ev.kind,
      title: ev.title,
      path: ev.path,
      url: ev.url,
    })),
    formatted: lines.join("\n"),
    total: events.length,
  };
}
