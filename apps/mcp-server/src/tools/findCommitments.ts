import { z } from "zod";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const InputSchema = z.object({
  query: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(["open", "done", "unknown"]).optional(),
  dueBefore: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export async function toolFindCommitments(
  input: z.input<typeof InputSchema>,
  repos: { commitments: CommitmentsRepo; threads: ThreadsRepo }
) {
  const { owner, status, dueBefore, limit, query } = InputSchema.parse(input);

  let commitments = repos.commitments.findAll({ owner, status, dueBefore, limit });

  if (query) {
    const q = query.toLowerCase();
    commitments = commitments.filter((c) => c.text.toLowerCase().includes(q));
  }

  const groupedByThread: Record<
    string,
    { thread: import("@threadline/common").Thread | null; commitments: typeof commitments }
  > = {};

  for (const c of commitments) {
    if (!groupedByThread[c.threadId]) {
      groupedByThread[c.threadId] = {
        thread: repos.threads.findById(c.threadId),
        commitments: [],
      };
    }
    groupedByThread[c.threadId].commitments.push(c);
  }

  return { commitments, groupedByThread };
}
