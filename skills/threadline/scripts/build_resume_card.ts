/**
 * Build and print a resume card for the most recently active thread.
 * Useful for testing the resume card output outside of an AI agent.
 *
 * Usage: npx ts-node skills/threadline/scripts/build_resume_card.ts [--thread <id>]
 */
import { ensureHomeDirs, loadConfig } from "../../../apps/mcp-server/src/config.js";
import { getDb } from "../../../apps/mcp-server/src/storage/db.js";
import { ArtifactsRepo } from "../../../apps/mcp-server/src/storage/repositories/artifactsRepo.js";
import { CommitmentsRepo } from "../../../apps/mcp-server/src/storage/repositories/commitmentsRepo.js";
import { EventsRepo } from "../../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "../../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { formatRelative } from "../../../apps/mcp-server/src/utils/dates.js";

async function main(): Promise<void> {
  const threadIdArg = process.argv[process.argv.indexOf("--thread") + 1];
  const config = loadConfig();
  ensureHomeDirs(config);
  const db = getDb(config.homeDir);

  const threadsRepo = new ThreadsRepo(db);
  const eventsRepo = new EventsRepo(db);
  const commitmentsRepo = new CommitmentsRepo(db);
  const artifactsRepo = new ArtifactsRepo(db);

  let thread: ReturnType<typeof threadsRepo.findAll>[0] | undefined;
  if (threadIdArg) {
    thread = threadsRepo.findAll().find((t) => t.id === threadIdArg);
  } else {
    const recent = threadsRepo.findRecent(1);
    thread = recent[0];
  }

  if (!thread) {
    console.log("No thread found.");
    return;
  }

  const events = eventsRepo.findByThreadId(thread.id, 5);
  const commitments = commitmentsRepo.findAll({ threadId: thread.id, status: "open" });
  const artifacts = artifactsRepo.findByThread(thread.id);

  console.log(`## ${thread.title}`);
  console.log(
    `**State:** ${thread.state} | **Last active:** ${formatRelative(thread.lastActiveAt)}`
  );
  console.log();
  if (thread.summary) console.log(`> ${thread.summary}`);
  console.log();

  if (events.length > 0) {
    console.log("**Recent activity:**");
    for (const e of events) {
      console.log(`- ${e.kind}: ${e.title}`);
    }
    console.log();
  }

  if (commitments.length > 0) {
    console.log("**Open commitments:**");
    for (const c of commitments) {
      console.log(`- [ ] ${c.text}`);
    }
    console.log();
  }

  if (artifacts.length > 0) {
    console.log("**Key artifacts:**");
    for (const a of artifacts.slice(0, 5)) {
      console.log(`- \`${a.locator}\` (${a.type})`);
    }
  }
}

main().catch((err) => {
  console.error("build_resume_card failed:", err);
  process.exit(1);
});
