#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ThreadlineEvent } from "@threadline/common";
import { THREADLINE_VERSION } from "@threadline/common";
import { ActiveWindowWatcher } from "./collectors/activeWindow.js";
import { BeadsMemoryWatcher } from "./collectors/beadsMemoryWatcher.js";
import { BrowserHistoryWatcher } from "./collectors/browserHistoryWatcher.js";
import { ClaudeSessionWatcher } from "./collectors/claudeSessionWatcher.js";
import { ClaudeTaskWatcher } from "./collectors/claudeTaskWatcher.js";
import { ClipboardWatcher } from "./collectors/clipboardWatcher.js";
import { FilesystemWatcher } from "./collectors/filesystemWatcher.js";
import { GitWatcher } from "./collectors/gitWatcher.js";
import { ensureHomeDirs, loadConfig } from "./config.js";
import { autoCloseMatchingCommitments, startScheduler } from "./daemon/scheduler.js";
import { startDaemon } from "./daemon/server.js";
import { clusterNewEvents } from "./engine/clusterThreads.js";
import { logger } from "./logger.js";
import { initAuditLog } from "./storage/auditLog.js";
import * as registry from "./storage/collectorRegistry.js";
import { closeDb, getDb } from "./storage/db.js";
import { ArtifactsRepo } from "./storage/repositories/artifactsRepo.js";
import { CheckpointsRepo } from "./storage/repositories/checkpointsRepo.js";
import { CleanupRepo } from "./storage/repositories/cleanupRepo.js";
import { CommitmentsRepo } from "./storage/repositories/commitmentsRepo.js";
import { EventsRepo } from "./storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "./storage/repositories/threadsRepo.js";
import { globalSearchIndex } from "./storage/searchIndex.js";
import { toolArchiveThread } from "./tools/archiveThread.js";
import { toolCaptureCheckpoint } from "./tools/captureCheckpoint.js";
import { toolExplainWhyOpen } from "./tools/explainWhyOpen.js";
import { toolExportThread } from "./tools/exportThread.js";
import { toolFindCommitments } from "./tools/findCommitments.js";
import { toolGetThreadDetails } from "./tools/getThreadDetails.js";
import { toolGetThreadTimeline } from "./tools/getThreadTimeline.js";
import { toolHealth } from "./tools/health.js";
import { toolImportThread } from "./tools/importThread.js";
import { toolListProjects } from "./tools/listProjects.js";
import { toolListRecentThreads } from "./tools/listRecentThreads.js";
import { toolMergeThreads } from "./tools/mergeThreads.js";
import { toolOpenThreadArtifacts } from "./tools/openThreadArtifacts.js";
import { toolPrepareHandoff } from "./tools/prepareHandoff.js";
import { toolResumeLastThread } from "./tools/resumeLastThread.js";
import { toolSafeCleanDownloads } from "./tools/safeCleanDownloads.js";
import { toolSearchEvents } from "./tools/searchEvents.js";
import { toolSearchThreads } from "./tools/searchThreads.js";
import { toolSplitThread } from "./tools/splitThread.js";
import { toolUndoLastCleanup } from "./tools/undoLastCleanup.js";

async function runDoctor(config: ReturnType<typeof loadConfig>): Promise<void> {
  const { isPortAvailable } = await import("./utils/process.js");
  console.log("=== Threadline Doctor ===\n");
  console.log(`Home dir: ${config.homeDir}`);
  console.log(`Daemon port: ${config.daemonPort}`);
  console.log(`Web UI: http://127.0.0.1:${config.daemonPort}/ui`);

  const portFree = await isPortAvailable(config.daemonPort);
  console.log(
    `Port ${config.daemonPort} available: ${portFree ? "yes" : "no (may already be running)"}`
  );

  const bhWatcher = new BrowserHistoryWatcher();
  const collectors = [
    ["filesystem", config.enableFilesystemWatcher],
    ["clipboard", config.enableClipboardWatcher],
    ["git", config.enableGitWatcher],
    ["browser_ingest", config.enableBrowserIngest],
    ["browser_history", config.enableBrowserHistoryWatcher],
    ["claude_sessions", config.enableClaudeSessionWatcher],
    ["beads_memory", config.enableBeadsMemoryWatcher],
    ["claude_tasks", config.enableClaudeTaskWatcher],
    ["active_window", config.enableActiveWindowWatcher],
  ];
  if (config.enableBrowserHistoryWatcher) {
    const detected = bhWatcher.detectedBrowsers();
    for (const b of detected) console.log(`    · ${b}`);
  }
  console.log("\nCollectors:");
  for (const [name, enabled] of collectors) {
    console.log(`  ${name}: ${enabled ? "enabled" : "disabled"}`);
  }
  console.log("\nAllowed paths:");
  for (const p of config.allowPaths) {
    console.log(`  ${p}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const config = loadConfig();
  ensureHomeDirs(config.homeDir);
  initAuditLog(config.homeDir);

  if (args.includes("--doctor")) {
    await runDoctor(config);
    process.exit(0);
  }

  const db = getDb(config.homeDir);
  const repos = {
    events: new EventsRepo(db),
    threads: new ThreadsRepo(db),
    artifacts: new ArtifactsRepo(db),
    commitments: new CommitmentsRepo(db),
    checkpoints: new CheckpointsRepo(db),
    cleanup: new CleanupRepo(db),
  };

  // Bootstrap search index from existing threads
  for (const t of repos.threads.findAll(1000)) {
    globalSearchIndex.add(t.id, [t.title, t.summary, t.signature, ...t.entityBag]);
  }

  // ── Ingest pipeline ──────────────────────────────────────────────────────
  // Issue 15: Batch events in a 2s window before clustering to reduce CPU spikes.
  // Issue 9:  Enrich clipboard events with last known active window context.
  let lastWindowEvent: ThreadlineEvent | null = null;
  const eventQueue: ThreadlineEvent[] = [];
  let batchTimer: NodeJS.Timeout | null = null;

  const flushBatch = async () => {
    if (eventQueue.length === 0) return;
    const batch = eventQueue.splice(0);
    for (const ev of batch) {
      // Issue 2: Deduplicated insert for browser/clipboard events
      const useDedup =
        ev.source === "browser" ||
        ev.source === "clipboard" ||
        ev.source === "beads_memory" ||
        ev.source === "claude_session";
      if (useDedup) {
        repos.events.insertDeduped(ev);
      } else {
        repos.events.insert(ev);
      }
    }
    await clusterNewEvents(batch, repos.events, repos.threads, repos.artifacts);

    // Issue 5: Auto-close commitments that match a git commit message
    for (const ev of batch) {
      if (ev.kind === "committed") {
        const threadMatch = repos.threads.findBySignatureTokens(
          ev.title
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3),
          3
        );
        const threadId = threadMatch[0]?.id ?? null;
        const closed = autoCloseMatchingCommitments(ev.title, threadId, repos);
        if (closed > 0) logger.info(`Auto-closed ${closed} commitment(s) via git commit`);
      }
    }
  };

  const ingestEvent = (rawEvent: ThreadlineEvent): void => {
    // Issue 9: Clipboard-window correlation — attach active window context
    let event = rawEvent;
    if (event.source === "clipboard" && lastWindowEvent) {
      const lag = event.ts - lastWindowEvent.ts;
      if (lag < 5000) {
        event = {
          ...event,
          metadata: {
            ...event.metadata,
            activeApp: lastWindowEvent.metadata?.appName,
            activeWindow: lastWindowEvent.title,
          },
        };
      }
    }
    if (event.source === "active_window") {
      lastWindowEvent = event;
    }

    // Register collector event
    registry.recordEvent(event.source, {});

    eventQueue.push(event);
    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        batchTimer = null;
        void flushBatch();
      }, 2000);
    }
  };

  // Register collectors in registry
  registry.registerCollector("filesystem", config.enableFilesystemWatcher);
  registry.registerCollector("clipboard", config.enableClipboardWatcher);
  registry.registerCollector("git", config.enableGitWatcher);
  registry.registerCollector("active_window", config.enableActiveWindowWatcher);
  registry.registerCollector("browser_history", config.enableBrowserHistoryWatcher);
  registry.registerCollector("browser_ingest", config.enableBrowserIngest);
  registry.registerCollector("claude_session", config.enableClaudeSessionWatcher);
  registry.registerCollector("beads_memory", config.enableBeadsMemoryWatcher);
  registry.registerCollector("claude_task", config.enableClaudeTaskWatcher);

  // Start collectors
  const fsWatcher = new FilesystemWatcher();
  const clipWatcher = new ClipboardWatcher(config.maxStoredClipboardChars);
  const gitWatcher = new GitWatcher();
  const awWatcher = new ActiveWindowWatcher();
  const bhWatcher = new BrowserHistoryWatcher();
  const csWatcher = new ClaudeSessionWatcher();
  const bmWatcher = new BeadsMemoryWatcher();
  const ctWatcher = new ClaudeTaskWatcher();

  if (config.enableFilesystemWatcher) fsWatcher.start(config.allowPaths, ingestEvent);
  if (config.enableClipboardWatcher) clipWatcher.start(ingestEvent);
  if (config.enableGitWatcher) gitWatcher.start(config.allowPaths, ingestEvent);
  if (config.enableActiveWindowWatcher) await awWatcher.start(ingestEvent);
  if (config.enableBrowserHistoryWatcher) bhWatcher.start(ingestEvent);
  if (config.enableClaudeSessionWatcher) csWatcher.start(ingestEvent);
  if (config.enableBeadsMemoryWatcher) bmWatcher.start(ingestEvent);
  if (config.enableClaudeTaskWatcher) ctWatcher.start(ingestEvent);

  const daemon = await startDaemon(config, repos);
  const stopScheduler = startScheduler(repos);

  const server = new Server(
    { name: "threadline", version: THREADLINE_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "health",
        description: "Check Threadline health, version, per-collector stats, and due-date alerts",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_recent_threads",
        description:
          "List recent work threads. Use when the user asks 'show my threads', 'what was I doing', 'show recent work', or 'show history'.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number" },
            state: { type: "string", enum: ["active", "waiting", "blocked", "stale", "archived"] },
          },
        },
      },
      {
        name: "get_thread_details",
        description:
          "Get full details of a specific thread including timeline, artifacts, and commitments",
        inputSchema: {
          type: "object",
          properties: {
            threadId: { type: "string" },
            includeEvents: { type: "boolean" },
            includeArtifacts: { type: "boolean" },
            includeCommitments: { type: "boolean" },
            eventLimit: { type: "number" },
          },
          required: ["threadId"],
        },
      },
      {
        name: "get_thread_timeline",
        description: "Get the event timeline for a thread",
        inputSchema: {
          type: "object",
          properties: { threadId: { type: "string" }, limit: { type: "number" } },
          required: ["threadId"],
        },
      },
      {
        name: "resume_last_thread",
        description:
          "Resume the most recent thread or find one matching a query. Use when the user says 'resume', 'continue where I left off', 'what was I working on'.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            includeArtifacts: { type: "boolean" },
            maxArtifacts: { type: "number" },
          },
        },
      },
      {
        name: "search_threads",
        description: "Search threads by keyword or entity",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            state: { type: "string" },
            limit: { type: "number" },
          },
          required: ["query"],
        },
      },
      {
        name: "search_events",
        description: "Search raw events by keyword, source, kind, or date range",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            source: { type: "string" },
            kind: { type: "string" },
            threadId: { type: "string" },
            sinceTs: { type: "number" },
            untilTs: { type: "number" },
            limit: { type: "number" },
          },
        },
      },
      {
        name: "find_commitments",
        description:
          "Find open commitments and action items, optionally filtered by owner, status, or due date",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            owner: { type: "string" },
            status: { type: "string", enum: ["open", "done", "unknown"] },
            dueBefore: { type: "string" },
            limit: { type: "number" },
          },
        },
      },
      {
        name: "prepare_handoff",
        description:
          "Prepare a handoff document for a thread with summary, commitments, and next steps",
        inputSchema: {
          type: "object",
          properties: {
            threadId: { type: "string" },
            query: { type: "string" },
            includeArtifacts: { type: "boolean" },
          },
        },
      },
      {
        name: "safe_clean_downloads",
        description:
          "Preview or perform safe cleanup of old Downloads files into a reversible quarantine",
        inputSchema: {
          type: "object",
          properties: {
            dryRun: { type: "boolean" },
            limit: { type: "number" },
            olderThanDays: { type: "number" },
            strategy: { type: "string", enum: ["by_thread", "by_extension", "by_age"] },
          },
        },
      },
      {
        name: "explain_why_open",
        description:
          "Explain why a file or URL is still open — which thread it belongs to and when it was last active",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
            url: { type: "string" },
            threadId: { type: "string" },
          },
        },
      },
      {
        name: "open_thread_artifacts",
        description: "Open files and URLs associated with a thread using system default apps",
        inputSchema: {
          type: "object",
          properties: { threadId: { type: "string" }, limit: { type: "number" } },
          required: ["threadId"],
        },
      },
      {
        name: "capture_checkpoint",
        description:
          "Capture a manual checkpoint with title, note, paths, and URLs. Extracts commitments from the note.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            note: { type: "string" },
            paths: { type: "array", items: { type: "string" } },
            urls: { type: "array", items: { type: "string" } },
          },
          required: ["title"],
        },
      },
      {
        name: "archive_thread",
        description: "Archive a thread to remove it from active listings",
        inputSchema: {
          type: "object",
          properties: { threadId: { type: "string" } },
          required: ["threadId"],
        },
      },
      {
        name: "undo_last_cleanup",
        description:
          "Undo the last safe_clean_downloads operation, restoring files to their original locations",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_projects",
        description:
          "List all detected projects with their threads, active status, and open commitments",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "split_thread",
        description: "Split selected events out of a thread into a new thread",
        inputSchema: {
          type: "object",
          properties: {
            threadId: { type: "string" },
            eventIds: { type: "array", items: { type: "string" } },
          },
          required: ["threadId", "eventIds"],
        },
      },
      {
        name: "merge_threads",
        description:
          "Merge two threads — moves all events, artifacts, and commitments from source into target",
        inputSchema: {
          type: "object",
          properties: {
            targetThreadId: { type: "string" },
            sourceThreadId: { type: "string" },
          },
          required: ["targetThreadId", "sourceThreadId"],
        },
      },
      {
        name: "export_thread",
        description:
          "Export a thread and all its events, artifacts, and commitments as portable JSON",
        inputSchema: {
          type: "object",
          properties: { threadId: { type: "string" } },
          required: ["threadId"],
        },
      },
      {
        name: "import_thread",
        description:
          "Import a previously exported thread JSON (e.g. from another machine or teammate)",
        inputSchema: {
          type: "object",
          properties: { data: { type: "string", description: "JSON string from export_thread" } },
          required: ["data"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // biome-ignore lint/suspicious/noExplicitAny: tool dispatch requires any cast for Zod parsing
    const input = (args ?? {}) as any;

    try {
      let result: unknown;

      switch (name) {
        case "health":
          result = await toolHealth({}, config, repos);
          break;
        case "list_recent_threads":
          result = await toolListRecentThreads(input, repos);
          break;
        case "get_thread_details":
          result = await toolGetThreadDetails(input, repos);
          break;
        case "get_thread_timeline":
          result = await toolGetThreadTimeline(input, repos);
          break;
        case "resume_last_thread":
          result = await toolResumeLastThread(input, repos);
          break;
        case "search_threads":
          result = await toolSearchThreads(input, repos);
          break;
        case "search_events":
          result = await toolSearchEvents(input, repos);
          break;
        case "find_commitments":
          result = await toolFindCommitments(input, repos);
          break;
        case "prepare_handoff":
          result = await toolPrepareHandoff(input, repos);
          break;
        case "safe_clean_downloads":
          result = await toolSafeCleanDownloads(
            input,
            config.homeDir,
            repos.cleanup,
            repos.threads
          );
          break;
        case "explain_why_open":
          result = await toolExplainWhyOpen(input, repos);
          break;
        case "open_thread_artifacts":
          result = await toolOpenThreadArtifacts(input, repos);
          break;
        case "capture_checkpoint":
          result = await toolCaptureCheckpoint(input, repos);
          break;
        case "archive_thread":
          result = await toolArchiveThread(input, repos);
          break;
        case "undo_last_cleanup":
          result = await toolUndoLastCleanup({}, repos.cleanup);
          break;
        case "list_projects":
          result = await toolListProjects(input, repos);
          break;
        case "split_thread":
          result = await toolSplitThread(input, repos);
          break;
        case "merge_threads":
          result = await toolMergeThreads(input, { ...repos, _store: db });
          break;
        case "export_thread":
          result = await toolExportThread(input, repos);
          break;
        case "import_thread":
          result = await toolImportThread(input, repos);
          break;
        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      logger.error(`Tool ${name} error`, err);
      return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Threadline MCP server started", {
    version: THREADLINE_VERSION,
    ui: `http://127.0.0.1:${config.daemonPort}/ui`,
  });

  const shutdown = async () => {
    if (batchTimer) {
      clearTimeout(batchTimer);
      await flushBatch();
    }
    fsWatcher.stop();
    clipWatcher.stop();
    gitWatcher.stop();
    awWatcher.stop();
    bhWatcher.stop();
    csWatcher.stop();
    bmWatcher.stop();
    ctWatcher.stop();
    stopScheduler();
    await daemon.stop();
    await server.close();
    closeDb();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
