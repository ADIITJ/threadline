/**
 * ClaudeSessionWatcher
 *
 * Reads Claude Code session JSONL files from ~/.claude/projects/.
 * Extracts user prompts, working directory, git branch, and session context.
 * Watches for new sessions and new messages in existing sessions using chokidar.
 *
 * Project name is derived from the directory path encoded in the project folder name
 * (Claude encodes `/Users/x/Documents/Projects/Foo` as `-Users-x-Documents-Projects-Foo`).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ThreadlineEvent } from "@threadline/common";
import chokidar, { type FSWatcher } from "chokidar";
import { logger } from "../logger.js";
import { redactSecrets } from "../security/redaction.js";
import { generateId } from "../utils/hashing.js";
import { extractEntities } from "../utils/text.js";

type EventCallback = (event: ThreadlineEvent) => void;

interface SessionRecord {
  offset: number; // byte offset of last read position
}

// Convert Claude project dir name back to filesystem path
// e.g. "-Users-foo-Documents-Projects-Threadline" → "/Users/foo/Documents/Projects/Threadline"
function decodePath(dirName: string): string {
  return dirName.replace(/^-/, "/").replace(/-/g, "/");
}

// Extract a human-readable project name from the encoded dir
function projectName(dirName: string): string {
  const decoded = decodePath(dirName);
  const parts = decoded.split("/").filter(Boolean);
  // Return last 2 segments: "Projects/Threadline" → "Threadline"
  return parts.at(-1) ?? dirName;
}

// Extract the project root path (cwd or decoded dir path)
function projectPath(dirName: string): string {
  return decodePath(dirName);
}

function parseUserMessages(
  content: string,
  fromOffset: number
): Array<{
  ts: number;
  text: string;
  cwd: string;
  gitBranch: string;
  sessionId: string;
}> {
  const results = [];
  const lines = content.slice(fromOffset).split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj.type !== "user") continue;

      const ts = obj.timestamp ? new Date(obj.timestamp as string).getTime() : Date.now();
      const cwd = (obj.cwd as string) ?? "";
      const gitBranch = (obj.gitBranch as string) ?? "";
      const sessionId = (obj.sessionId as string) ?? "";

      const msg = obj.message as Record<string, unknown> | undefined;
      if (!msg) continue;

      const rawContent = msg.content;
      let text = "";

      if (typeof rawContent === "string") {
        text = rawContent.trim();
      } else if (Array.isArray(rawContent)) {
        for (const part of rawContent as Array<Record<string, unknown>>) {
          if (part.type === "text" && typeof part.text === "string") {
            text += part.text;
          }
        }
        text = text.trim();
      }

      // Skip system/internal messages
      if (!text) continue;
      if (text.startsWith("<local-command")) continue;
      if (text.startsWith("<command-name>")) continue;
      if (text.startsWith("<system-reminder>")) continue;
      if (text.startsWith("This session is being continued")) continue;
      if (text === "clear" || text === "resume") continue;

      results.push({ ts, text, cwd, gitBranch, sessionId });
    } catch {
      // skip malformed lines
    }
  }
  return results;
}

export class ClaudeSessionWatcher {
  private watcher: FSWatcher | null = null;
  private callback: EventCallback | null = null;
  private sessions = new Map<string, SessionRecord>();
  private claudeDir: string;

  constructor() {
    this.claudeDir = join(homedir(), ".claude", "projects");
  }

  start(callback: EventCallback): void {
    this.callback = callback;

    if (!existsSync(this.claudeDir)) {
      logger.info("ClaudeSessionWatcher: ~/.claude/projects not found, skipping");
      return;
    }

    // Watch all session JSONL files
    this.watcher = chokidar.watch(`${this.claudeDir}/**/*.jsonl`, {
      ignoreInitial: false,
      persistent: true,
      depth: 3,
    });

    this.watcher
      .on("add", (filePath) => this.processFile(filePath))
      .on("change", (filePath) => this.processFile(filePath))
      .on("error", (err) => logger.debug("ClaudeSessionWatcher error", { err }));

    logger.info("ClaudeSessionWatcher started", { dir: this.claudeDir });
  }

  private processFile(filePath: string): void {
    if (!this.callback) return;

    // Derive project info from path
    // filePath: ~/.claude/projects/<project-dir>/<session-id>.jsonl
    const relative = filePath.replace(`${this.claudeDir}/`, "");
    const parts = relative.split("/");
    if (parts.length < 2) return;

    const projectDir = parts[0];
    const project = projectName(projectDir);
    const projPath = projectPath(projectDir);

    try {
      const content = readFileSync(filePath, "utf-8");
      const record = this.sessions.get(filePath) ?? { offset: 0 };
      const messages = parseUserMessages(content, record.offset);

      // Update offset to end of file
      this.sessions.set(filePath, { offset: Buffer.byteLength(content, "utf-8") });

      for (const { ts, text, cwd, gitBranch, sessionId } of messages) {
        const safeText = redactSecrets(text);
        const effectivePath = cwd || projPath;

        const event: ThreadlineEvent = {
          id: generateId("cs"),
          ts,
          source: "claude_session",
          kind: "note",
          actor: "user",
          title: safeText.slice(0, 100).replace(/\n/g, " "),
          text: safeText.slice(0, 500),
          path: effectivePath,
          tags: ["claude-session", project.toLowerCase().replace(/\s+/g, "-")],
          entities: [project, ...extractEntities(safeText), ...(gitBranch ? [gitBranch] : [])],
          metadata: {
            project,
            projectPath: effectivePath,
            sessionId,
            gitBranch,
            sessionFile: basename(filePath),
          },
        };

        this.callback(event);
      }
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
