import type { Artifact, ThreadlineEvent } from "@threadline/common";
import { z } from "zod";
import { explainPresence } from "../engine/explainPresence.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const InputSchema = z.object({
  path: z.string().optional(),
  url: z.string().optional(),
  threadId: z.string().optional(),
});

export async function toolExplainWhyOpen(
  input: z.input<typeof InputSchema>,
  repos: { events: EventsRepo; threads: ThreadsRepo; artifacts: ArtifactsRepo }
) {
  const { path, url, threadId } = InputSchema.parse(input);
  const locator = path ?? url ?? "";

  let thread = threadId ? repos.threads.findById(threadId) : null;
  let events: ThreadlineEvent[] = [];

  if (!thread && locator) {
    const artifact = repos.artifacts.findByLocator(locator);
    if (artifact) {
      const threads = repos.threads.findAll(100);
      thread = threads.find((t) => t.artifactIds.includes(artifact.id)) ?? null;
    }
    const allEvents = repos.events.findRecent(500);
    events = allEvents.filter((e) => (path && e.path === path) || (url && e.url === url));
  } else if (thread) {
    events = repos.events.findByThreadId(thread.id, 10);
  }

  const artifacts: Artifact[] = locator
    ? ([repos.artifacts.findByLocator(locator)].filter(Boolean) as Artifact[])
    : [];

  const explanation = explainPresence(locator || threadId || "", thread, events, artifacts);

  return {
    explanation,
    linkedThread: thread,
    supportingArtifacts: artifacts,
    relatedEvents: events.slice(0, 5),
  };
}
