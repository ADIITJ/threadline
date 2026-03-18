/**
 * Bootstrap the Threadline search index from existing stored threads and events.
 * Run once after initial install or after a database migration.
 *
 * Usage: npx ts-node skills/threadline/scripts/bootstrap_index.ts
 */
import { ensureHomeDirs, loadConfig } from "../../../apps/mcp-server/src/config.js";
import { getDb } from "../../../apps/mcp-server/src/storage/db.js";
import { ThreadsRepo } from "../../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "../../../apps/mcp-server/src/storage/searchIndex.js";

async function main(): Promise<void> {
  const config = loadConfig();
  ensureHomeDirs(config);

  const db = getDb(config.homeDir);
  const threadsRepo = new ThreadsRepo(db);

  const threads = threadsRepo.findAll();
  let indexed = 0;

  for (const thread of threads) {
    globalSearchIndex.indexThread(thread.id, thread.title, thread.summary ?? "");
    indexed++;
  }

  console.log(`Indexed ${indexed} threads into search index.`);
}

main().catch((err) => {
  console.error("bootstrap_index failed:", err);
  process.exit(1);
});
