/**
 * Extract and display all open commitments from all threads.
 * Useful for auditing what Threadline has captured.
 *
 * Usage: npx ts-node skills/threadline/scripts/extract_commitments.ts [--thread <id>]
 */
import { ensureHomeDirs, loadConfig } from "../../../apps/mcp-server/src/config.js";
import { getDb } from "../../../apps/mcp-server/src/storage/db.js";
import { CommitmentsRepo } from "../../../apps/mcp-server/src/storage/repositories/commitmentsRepo.js";
import { ThreadsRepo } from "../../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { formatTs } from "../../../apps/mcp-server/src/utils/dates.js";

async function main(): Promise<void> {
  const threadIdArg = process.argv[process.argv.indexOf("--thread") + 1];
  const config = loadConfig();
  ensureHomeDirs(config);
  const db = getDb(config.homeDir);

  const commitmentsRepo = new CommitmentsRepo(db);
  const threadsRepo = new ThreadsRepo(db);

  const filters: { threadId?: string; status?: "open" | "done" } = { status: "open" };
  if (threadIdArg) filters.threadId = threadIdArg;

  const commitments = commitmentsRepo.findAll(filters);

  if (commitments.length === 0) {
    console.log("No open commitments found.");
    return;
  }

  const threadMap = new Map(threadsRepo.findAll().map((t) => [t.id, t.title]));

  let currentThread = "";
  for (const c of commitments) {
    const title = threadMap.get(c.threadId) ?? c.threadId;
    if (title !== currentThread) {
      console.log(`\n## ${title}`);
      currentThread = title;
    }
    const due = c.dueDate ? ` (due ${formatTs(c.dueDate)})` : "";
    console.log(`- [ ] ${c.text}${due}`);
  }
  console.log(`\nTotal: ${commitments.length} open commitment(s)`);
}

main().catch((err) => {
  console.error("extract_commitments failed:", err);
  process.exit(1);
});
