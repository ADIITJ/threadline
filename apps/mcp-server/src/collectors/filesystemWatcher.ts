import { extname } from "node:path";
import type { ThreadlineEvent } from "@threadline/common";
import { IGNORED_DIRS } from "@threadline/common";
import chokidar, { type FSWatcher } from "chokidar";
import { logger } from "../logger.js";
import { isPathAllowed } from "../security/pathSafety.js";
import { redactSecrets } from "../security/redaction.js";
import { getExtension, safeContentHash } from "../utils/fs.js";
import { generateId } from "../utils/hashing.js";
import { extractEntities } from "../utils/text.js";
import { normalizeText } from "../utils/text.js";

const IGNORED_EXT = new Set([".lock", ".log", ".tmp", ".swp", ".swo", ".DS_Store"]);

type EventCallback = (event: ThreadlineEvent) => void;

export class FilesystemWatcher {
  private watcher: FSWatcher | null = null;
  private callback: EventCallback | null = null;

  start(watchPaths: string[], callback: EventCallback): void {
    this.callback = callback;

    const ignored = (p: string) => {
      const parts = p.split(/[/\\]/);
      return (
        parts.some((part) => IGNORED_DIRS.has(part)) || IGNORED_EXT.has(extname(p).toLowerCase())
      );
    };

    this.watcher = chokidar.watch(watchPaths, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      depth: 5,
    });

    this.watcher
      .on("add", (p) => this.emit(p, "created"))
      .on("change", (p) => this.emit(p, "modified"))
      .on("unlink", (p) => this.emit(p, "deleted"))
      .on("error", (err) => logger.warn("Filesystem watcher error", err));

    logger.info("Filesystem watcher started", { paths: watchPaths });
  }

  private emit(filePath: string, kind: ThreadlineEvent["kind"]): void {
    if (!this.callback) return;

    const ext = getExtension(filePath);
    const title = filePath.split("/").pop() ?? filePath;
    const contentHash = kind !== "deleted" ? safeContentHash(filePath) : undefined;

    const event: ThreadlineEvent = {
      id: generateId("fs"),
      ts: Date.now(),
      source: "filesystem",
      kind,
      actor: "user",
      title: normalizeText(title),
      text: "",
      path: filePath,
      ext,
      tags: [],
      entities: extractEntities(filePath),
      metadata: {},
      ...(contentHash && { contentHash }),
    };

    this.callback(event);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
