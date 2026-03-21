/**
 * ClaudeTaskWatcher
 *
 * Polls ~/.claude/todos/ for Claude Code task/todo JSON files.
 * Maps todo items to Threadline commitments and events.
 * Also reads ~/.claude/plans/ for plan markdown files.
 *
 * Todos schema: Array<{ content: string, status: "pending"|"in_progress"|"completed", activeForm?: string }>
 * Plans: markdown files with plan content
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ThreadlineEvent } from "@threadline/common";
import { logger } from "../logger.js";
import { redactSecrets } from "../security/redaction.js";
import { generateId, shortHash } from "../utils/hashing.js";

type EventCallback = (event: ThreadlineEvent) => void;

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

const POLL_INTERVAL_MS = 30_000;

export class ClaudeTaskWatcher {
  private interval: NodeJS.Timeout | null = null;
  private callback: EventCallback | null = null;
  private todosDir: string;
  private plansDir: string;
  private seenHashes = new Map<string, string>(); // filePath → content hash

  constructor() {
    this.todosDir = join(homedir(), ".claude", "todos");
    this.plansDir = join(homedir(), ".claude", "plans");
  }

  start(callback: EventCallback): void {
    this.callback = callback;

    // Run immediately, then poll
    this.poll();
    this.interval = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    logger.info("ClaudeTaskWatcher started", {
      todosDir: this.todosDir,
      plansDir: this.plansDir,
    });
  }

  private poll(): void {
    if (!this.callback) return;
    this.pollTodos();
    this.pollPlans();
  }

  private pollTodos(): void {
    if (!existsSync(this.todosDir)) return;

    let files: string[];
    try {
      files = readdirSync(this.todosDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }

    for (const file of files) {
      const filePath = join(this.todosDir, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        if (!content.trim() || content.trim() === "[]") continue;

        const hash = shortHash(content);
        if (this.seenHashes.get(filePath) === hash) continue;
        this.seenHashes.set(filePath, hash);

        const todos = JSON.parse(content) as TodoItem[];
        if (!Array.isArray(todos) || todos.length === 0) continue;

        // Extract session ID from filename: <session-id>-agent-<agent-id>.json
        const sessionId = file.split("-agent-")[0] ?? file.replace(".json", "");

        // Emit one event per non-empty todo file summarising the task list
        const open = todos.filter((t) => t.status !== "completed");
        const done = todos.filter((t) => t.status === "completed");

        const summary = [
          open.length > 0 ? `Open: ${open.map((t) => t.content).join("; ")}` : "",
          done.length > 0 ? `Done: ${done.map((t) => t.content).join("; ")}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        const safe = redactSecrets(summary);

        const event: ThreadlineEvent = {
          id: generateId("ct"),
          ts: Date.now(),
          source: "claude_task",
          kind: "note",
          actor: "claude",
          title: `Tasks (${open.length} open, ${done.length} done)`,
          text: safe,
          tags: ["claude-task", "todo"],
          entities: [],
          metadata: {
            sessionId,
            openCount: open.length,
            doneCount: done.length,
            todos: todos.map((t) => ({ content: t.content, status: t.status })),
          },
        };

        this.callback?.(event);
      } catch {
        // skip malformed files
      }
    }
  }

  private pollPlans(): void {
    if (!existsSync(this.plansDir)) return;

    let files: string[];
    try {
      files = readdirSync(this.plansDir).filter((f) => f.endsWith(".md"));
    } catch {
      return;
    }

    for (const file of files) {
      const filePath = join(this.plansDir, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        if (!content.trim()) continue;

        const hash = shortHash(content);
        if (this.seenHashes.get(filePath) === hash) continue;
        this.seenHashes.set(filePath, hash);

        const safe = redactSecrets(content);

        // Extract title from first heading
        const titleMatch = safe.match(/^#+ (.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : basename(file, ".md");

        const event: ThreadlineEvent = {
          id: generateId("cp"),
          ts: Date.now(),
          source: "claude_task",
          kind: "checkpoint_created",
          actor: "claude",
          title: `Plan: ${title.slice(0, 80)}`,
          text: safe.slice(0, 1000),
          path: filePath,
          tags: ["claude-plan"],
          entities: [],
          metadata: {
            planFile: file,
            planTitle: title,
            contentLength: content.length,
          },
        };

        this.callback?.(event);
      } catch {
        // skip malformed files
      }
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
