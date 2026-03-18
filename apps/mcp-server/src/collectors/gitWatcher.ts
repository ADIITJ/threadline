import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ThreadlineEvent } from "@threadline/common";
import simpleGit from "simple-git";
import { logger } from "../logger.js";
import { generateId } from "../utils/hashing.js";

const POLL_INTERVAL_MS = 30000;

interface RepoState {
  branch: string;
  lastCommitHash: string;
}

type EventCallback = (event: ThreadlineEvent) => void;

export class GitWatcher {
  private intervals: NodeJS.Timeout[] = [];
  private repoStates = new Map<string, RepoState>();
  private callback: EventCallback | null = null;

  start(watchPaths: string[], callback: EventCallback): void {
    this.callback = callback;

    const repoPaths = watchPaths.filter((p) => existsSync(join(p, ".git")));
    if (repoPaths.length === 0) {
      // No repos directly, scan a level deep
      // This is a best-effort discovery
    }

    for (const repoPath of repoPaths) {
      this.watchRepo(repoPath);
    }

    // Also discover repos one level deep inside watch paths
    for (const watchPath of watchPaths) {
      this.discoverAndWatch(watchPath);
    }

    logger.info("Git watcher started", { repoPaths: repoPaths.length });
  }

  private discoverAndWatch(basePath: string): void {
    const { readdirSync } = require("node:fs") as typeof import("fs");
    try {
      const entries = readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = join(basePath, entry.name);
        if (existsSync(join(candidate, ".git"))) {
          this.watchRepo(candidate);
        }
      }
    } catch {
      // Ignore inaccessible dirs
    }
  }

  private watchRepo(repoPath: string): void {
    if (this.repoStates.has(repoPath)) return;

    const git = simpleGit(repoPath);
    this.repoStates.set(repoPath, { branch: "", lastCommitHash: "" });

    const poll = async () => {
      try {
        const status = await git.status();
        const log = await git.log({ maxCount: 1 });
        const branch = status.current ?? "unknown";
        const hash = log.latest?.hash ?? "";

        const prev = this.repoStates.get(repoPath);
        if (!prev) return;

        if (prev.branch && prev.branch !== branch) {
          this.emit({
            source: "git",
            kind: "branch_changed",
            title: `Branch changed: ${prev.branch} → ${branch}`,
            text: `Repository: ${repoPath}`,
            repoPath,
            metadata: { from: prev.branch, to: branch },
          });
        }

        if (hash && prev.lastCommitHash && hash !== prev.lastCommitHash && log.latest) {
          this.emit({
            source: "git",
            kind: "committed",
            title: log.latest.message ?? "commit",
            text: `Author: ${log.latest.author_name} | Hash: ${hash}`,
            repoPath,
            metadata: {
              hash,
              author: log.latest.author_name,
              date: log.latest.date,
            },
          });
        }

        this.repoStates.set(repoPath, { branch, lastCommitHash: hash });
      } catch {
        // Ignore git errors
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    this.intervals.push(interval);
  }

  private emit(partial: Omit<ThreadlineEvent, "id" | "ts" | "actor" | "tags" | "entities">): void {
    if (!this.callback) return;
    const ev: ThreadlineEvent = {
      id: generateId("git"),
      ts: Date.now(),
      actor: "user",
      tags: [],
      entities: [],
      source: partial.source,
      kind: partial.kind,
      title: partial.title,
      text: partial.text,
      path: partial.path,
      repoPath: partial.repoPath,
      url: partial.url,
      hostname: partial.hostname,
      ext: partial.ext,
      threadCandidateKey: partial.threadCandidateKey,
      contentHash: partial.contentHash,
      metadata: partial.metadata,
    };
    this.callback(ev);
  }

  stop(): void {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }
}
