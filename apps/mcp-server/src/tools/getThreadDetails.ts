import { z } from "zod";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { formatRelative, formatTs } from "../utils/dates.js";
import { truncate } from "../utils/text.js";

const InputSchema = z.object({
  threadId: z.string().min(1),
  includeEvents: z.boolean().default(true),
  includeArtifacts: z.boolean().default(true),
  includeCommitments: z.boolean().default(true),
  eventLimit: z.number().int().min(1).max(500).default(100),
});

export async function toolGetThreadDetails(
  input: z.input<typeof InputSchema>,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  }
) {
  const { threadId, includeEvents, includeArtifacts, includeCommitments, eventLimit } =
    InputSchema.parse(input);

  const thread = repos.threads.findById(threadId);
  if (!thread) {
    return { error: `Thread ${threadId} not found` };
  }

  const timeline = includeEvents ? repos.events.findByThreadId(threadId, eventLimit) : [];
  const artifacts = includeArtifacts ? repos.artifacts.findByThreadId(threadId) : [];
  const commitments = includeCommitments ? repos.commitments.findByThreadId(threadId) : [];
  const checkpoints = repos.checkpoints.findByThreadId(threadId);

  // Find related threads by shared repos/urls
  const relatedThreads = repos.threads
    .findAll(50)
    .filter(
      (t) =>
        t.id !== threadId &&
        (thread.repoPaths.some((r) => t.repoPaths.includes(r)) ||
          thread.urls.some((u) => t.urls.includes(u)))
    )
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      title: t.title,
      state: t.state,
      lastSeenTs: t.lastSeenTs,
      artifactCount: repos.artifacts.countByThread(t.id),
      commitmentCount: repos.commitments.countByThread(t.id),
      score: t.score,
    }));

  const formatted = formatThreadDetails(thread, timeline, artifacts, commitments);

  return {
    thread,
    timeline,
    artifacts,
    commitments,
    checkpoints,
    relatedThreads,
    formatted,
  };
}

function formatThreadDetails(...args: Parameters<typeof buildFormattedDetail>): string {
  return buildFormattedDetail(...args);
}

function buildFormattedDetail(
  thread: import("@threadline/common").Thread,
  timeline: import("@threadline/common").ThreadlineEvent[],
  artifacts: import("@threadline/common").Artifact[],
  commitments: import("@threadline/common").Commitment[]
): string {
  const lines: string[] = [];
  lines.push(`## ${thread.title}`);
  lines.push(
    `**State:** ${thread.state} | **Score:** ${Math.round(thread.score * 100)}% | **Last active:** ${formatRelative(thread.lastSeenTs)}`
  );
  if (thread.summary) lines.push(`\n> ${thread.summary}\n`);

  if (timeline.length > 0) {
    lines.push("### Recent Activity");
    for (const ev of timeline.slice(0, 10)) {
      const loc = ev.path ?? ev.url ?? "";
      lines.push(
        `- [${formatTs(ev.ts).slice(11, 19)}] **${ev.kind}** ${truncate(ev.title || loc, 80)}`
      );
    }
    lines.push("");
  }

  if (artifacts.length > 0) {
    lines.push("### Artifacts");
    for (const a of artifacts.slice(0, 10)) {
      lines.push(
        `- \`${truncate(a.locator, 80)}\` (${a.type}) — last seen ${formatRelative(a.lastSeenTs)}`
      );
    }
    lines.push("");
  }

  const open = commitments.filter((c) => c.status === "open");
  if (open.length > 0) {
    lines.push("### Open Commitments");
    for (const c of open) {
      const due = c.dueDate ? ` _(due ${c.dueDate})_` : "";
      lines.push(`- [ ] ${truncate(c.text, 100)}${due}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
