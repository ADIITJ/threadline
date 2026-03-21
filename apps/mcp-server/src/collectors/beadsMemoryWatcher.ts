/**
 * BeadsMemoryWatcher
 *
 * Reads Beads (Claude Code auto-memory) files from ~/.claude/projects/<project>/memory/.
 * Each project has a MEMORY.md index and individual memory files.
 * When a memory file changes, we emit a checkpoint event with the full content.
 * This gives Threadline awareness of what Beads has captured per project.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ThreadlineEvent } from "@threadline/common";
import chokidar, { type FSWatcher } from "chokidar";
import { logger } from "../logger.js";
import { redactSecrets } from "../security/redaction.js";
import { generateId, shortHash } from "../utils/hashing.js";

type EventCallback = (event: ThreadlineEvent) => void;

function projectNameFromDir(projectDir: string): string {
  const decoded = projectDir.replace(/^-/, "/").replace(/-/g, "/");
  return decoded.split("/").filter(Boolean).at(-1) ?? projectDir;
}

function projectPathFromDir(projectDir: string): string {
  return projectDir.replace(/^-/, "/").replace(/-/g, "/");
}

export class BeadsMemoryWatcher {
  private watcher: FSWatcher | null = null;
  private callback: EventCallback | null = null;
  private claudeDir: string;
  private lastHashes = new Map<string, string>();

  constructor() {
    this.claudeDir = join(homedir(), ".claude", "projects");
  }

  start(callback: EventCallback): void {
    this.callback = callback;

    if (!existsSync(this.claudeDir)) {
      logger.info("BeadsMemoryWatcher: ~/.claude/projects not found, skipping");
      return;
    }

    // Watch all .md files inside memory subdirectories
    this.watcher = chokidar.watch(`${this.claudeDir}/*/memory/*.md`, {
      ignoreInitial: false,
      persistent: true,
      depth: 4,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher
      .on("add", (filePath) => this.processFile(filePath))
      .on("change", (filePath) => this.processFile(filePath))
      .on("error", (err) => logger.debug("BeadsMemoryWatcher error", { err }));

    logger.info("BeadsMemoryWatcher started", { dir: this.claudeDir });
  }

  private processFile(filePath: string): void {
    if (!this.callback) return;

    try {
      const content = readFileSync(filePath, "utf-8");
      if (!content.trim()) return;

      const hash = shortHash(content);
      if (this.lastHashes.get(filePath) === hash) return;
      this.lastHashes.set(filePath, hash);

      // Derive project from path: ~/.claude/projects/<project-dir>/memory/<file>.md
      const relative = filePath.replace(`${this.claudeDir}/`, "");
      const projectDir = relative.split("/")[0];
      const project = projectNameFromDir(projectDir);
      const projPath = projectPathFromDir(projectDir);
      const fileName = basename(filePath, ".md");

      const safe = redactSecrets(content);

      // Extract first heading as title
      const headingMatch = safe.match(/^#+ (.+)/m);
      const title = headingMatch ? headingMatch[1].trim() : `${project} memory: ${fileName}`;

      const event: ThreadlineEvent = {
        id: generateId("bm"),
        ts: Date.now(),
        source: "beads_memory",
        kind: "checkpoint_created",
        actor: "beads",
        title: title.slice(0, 120),
        text: safe.slice(0, 2000),
        path: filePath,
        tags: ["beads", "memory", project.toLowerCase().replace(/\s+/g, "-")],
        entities: [project],
        metadata: {
          project,
          projectPath: projPath,
          memoryFile: fileName,
          contentLength: content.length,
        },
      };

      this.callback(event);
    } catch {
      // skip unreadable files
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
