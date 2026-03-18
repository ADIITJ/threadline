import { tokenize } from "@threadline/engine-core";
import { z } from "zod";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "../storage/searchIndex.js";

const InputSchema = z.object({
  query: z.string().min(1),
  state: z.enum(["active", "waiting", "blocked", "stale", "archived"]).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export async function toolSearchThreads(
  input: z.input<typeof InputSchema>,
  repos: { threads: ThreadsRepo }
) {
  const { query, state, limit } = InputSchema.parse(input);

  const searchResults = globalSearchIndex.search(query, limit * 2);

  const matches = [];
  for (const result of searchResults) {
    const thread = repos.threads.findById(result.id);
    if (!thread) continue;
    if (state && thread.state !== state) continue;

    const highlights = getHighlights(thread, query);
    matches.push({ thread, score: result.score, highlights });

    if (matches.length >= limit) break;
  }

  return { matches };
}

function getHighlights(thread: import("@threadline/common").Thread, query: string): string[] {
  const qTokens = new Set(tokenize(query));
  const highlights: string[] = [];

  if (tokenize(thread.title).some((t) => qTokens.has(t))) {
    highlights.push(thread.title);
  }
  if (thread.summary && tokenize(thread.summary).some((t) => qTokens.has(t))) {
    highlights.push(thread.summary.slice(0, 100));
  }
  for (const e of thread.entityBag) {
    if (qTokens.has(e.toLowerCase())) highlights.push(e);
  }

  return highlights.slice(0, 3);
}
