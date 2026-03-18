import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
/**
 * Backfill git context for threads that were created before git watching was enabled.
 * Scans allowlisted paths for git repos and injects recent commit events.
 *
 * Usage: npx ts-node skills/threadline/scripts/backfill_git_context.ts [--days 7]
 */
import { simpleGit } from "simple-git";
import { ensureHomeDirs, loadConfig } from "../../../apps/mcp-server/src/config.js";
import { getDb } from "../../../apps/mcp-server/src/storage/db.js";
import { EventsRepo } from "../../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { nowMs } from "../../../apps/mcp-server/src/utils/dates.js";
import { generateId } from "../../../apps/mcp-server/src/utils/hashing.js";

const DAYS = Number.parseInt(process.argv[process.argv.indexOf("--days") + 1] ?? "7", 10) || 7;
const SINCE = `${DAYS} days ago`;

function findGitRepos(root: string, depth = 3): string[] {
  if (depth === 0) return [];
  const repos: string[] = [];
  if (existsSync(join(root, ".git"))) {
    repos.push(root);
    return repos;
  }
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        repos.push(...findGitRepos(join(root, entry.name), depth - 1));
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return repos;
}

async function main(): Promise<void> {
  const config = loadConfig();
  ensureHomeDirs(config);
  const db = getDb(config.homeDir);
  const eventsRepo = new EventsRepo(db);

  let injected = 0;

  for (const allowedPath of config.allowPaths) {
    const repos = findGitRepos(allowedPath);
    for (const repoPath of repos) {
      const git = simpleGit(repoPath);
      try {
        const log = await git.log(["--since", SINCE, "--format=%H|%an|%s|%ai"]);
        const repoName = repoPath.split("/").at(-1) ?? repoPath;
        for (const commit of log.all) {
          const parts = (commit as unknown as { hash: string }).hash.split("|");
          if (parts.length < 4) continue;
          const [hash, author, message, dateStr] = parts;
          const ts = new Date(dateStr).getTime();
          if (Number.isNaN(ts)) continue;
          eventsRepo.insert({
            id: generateId(),
            source: "git",
            kind: "commit",
            ts,
            actor: author,
            title: message,
            locator: `git:${repoName}:${hash.slice(0, 7)}`,
            tags: [],
            entities: [repoName],
            threadId: null,
            metadata: JSON.stringify({ repo: repoName, hash }),
          });
          injected++;
        }
      } catch {
        // skip repos that can't be read
      }
    }
  }

  console.log(`Backfilled ${injected} git commit events from the last ${DAYS} days.`);
}

main().catch((err) => {
  console.error("backfill_git_context failed:", err);
  process.exit(1);
});
