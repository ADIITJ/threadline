import { z } from "zod";
import { buildResumeCard, buildSuggestedActions } from "../engine/buildResumeCard.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "../storage/searchIndex.js";

const InputSchema = z.object({
  query: z.string().optional(),
  includeArtifacts: z.boolean().default(true),
  maxArtifacts: z.number().int().min(1).max(30).default(10),
});

export async function toolResumeLastThread(
  input: z.input<typeof InputSchema>,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
  }
) {
  const { query, includeArtifacts, maxArtifacts } = InputSchema.parse(input);

  let thread = null;

  if (query) {
    const matches = globalSearchIndex.search(query, 5);
    for (const m of matches) {
      const t = repos.threads.findById(m.id);
      if (t && t.state !== "archived") {
        thread = t;
        break;
      }
    }
  }

  if (!thread) {
    const recent = repos.threads.findRecent(1);
    thread = recent[0] ?? null;
  }

  if (!thread) {
    return { error: "No threads found. Start capturing events to build thread history." };
  }

  const events = repos.events.findByThreadId(thread.id, 20);
  const commitments = repos.commitments.findByThreadId(thread.id);
  const artifacts = includeArtifacts
    ? repos.artifacts.findByThreadId(thread.id).slice(0, maxArtifacts)
    : [];

  const summaryCard = buildResumeCard(
    thread,
    commitments,
    artifacts,
    events.map((e) => e.title).filter(Boolean)
  );
  const suggestedActions = buildSuggestedActions(thread, commitments);

  return { thread, summaryCard, commitments, suggestedActions, artifacts };
}
