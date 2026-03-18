import { z } from "zod";
import { writeAudit } from "../storage/auditLog.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";

const InputSchema = z.object({
  threadId: z.string().min(1),
});

export async function toolArchiveThread(
  input: z.input<typeof InputSchema>,
  repos: { threads: ThreadsRepo }
) {
  const { threadId } = InputSchema.parse(input);

  const thread = repos.threads.findById(threadId);
  if (!thread) return { error: `Thread ${threadId} not found` };

  repos.threads.updateState(threadId, "archived");
  writeAudit({ action: "thread_archived", actor: "user", subject: threadId });

  return {
    archived: true,
    thread: { ...thread, state: "archived" as const },
  };
}
