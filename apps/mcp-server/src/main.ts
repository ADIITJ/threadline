#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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
import { startScheduler } from "./daemon/scheduler.js";
import { startDaemon } from "./daemon/server.js";
import { clusterNewEvents } from "./engine/clusterThreads.js";
import { logger } from "./logger.js";
import { initAuditLog } from "./storage/auditLog.js";
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
import { toolFindCommitments } from "./tools/findCommitments.js";
import { toolGetThreadDetails } from "./tools/getThreadDetails.js";
import { toolGetThreadTimeline } from "./tools/getThreadTimeline.js";
import { toolHealth } from "./tools/health.js";
import { toolListProjects } from "./tools/listProjects.js";
import { toolListRecentThreads } from "./tools/listRecentThreads.js";
import { toolOpenThreadArtifacts } from "./tools/openThreadArtifacts.js";
import { toolPrepareHandoff } from "./tools/prepareHandoff.js";
import { toolResumeLastThread } from "./tools/resumeLastThread.js";
import { toolSafeCleanDownloads } from "./tools/safeCleanDownloads.js";
import { toolSearchThreads } from "./tools/searchThreads.js";
import { toolUndoLastCleanup } from "./tools/undoLastCleanup.js";

async function runDoctor(config: ReturnType<typeof loadConfig>): Promise<void> {
  const { isPortAvailable } = await import("./utils/process.js");
  console.log("=== Threadline Doctor ===\n");
  console.log(`Home dir: ${config.homeDir}`);
  console.log(`Daemon port: ${config.daemonPort}`);

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
    if (detected.length > 0) {
      collectors.push(["  detected browsers", true]);
      for (const b of detected) {
        console.log(`    · ${b}`);
      }
    }
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
  const existingThreads = repos.threads.findAll(1000);
  for (const t of existingThreads) {
    globalSearchIndex.add(t.id, [t.title, t.summary, t.signature, ...t.entityBag]);
  }

  // Start collectors
  const fsWatcher = new FilesystemWatcher();
  const clipWatcher = new ClipboardWatcher(config.maxStoredClipboardChars);
  const gitWatcher = new GitWatcher();
  const awWatcher = new ActiveWindowWatcher();
  const bhWatcher = new BrowserHistoryWatcher();
  const csWatcher = new ClaudeSessionWatcher();
  const bmWatcher = new BeadsMemoryWatcher();
  const ctWatcher = new ClaudeTaskWatcher();

  const ingestEvent = async (event: import("@threadline/common").ThreadlineEvent) => {
    repos.events.insert(event);
    await clusterNewEvents([event], repos.events, repos.threads, repos.artifacts);
  };

  if (config.enableFilesystemWatcher) {
    fsWatcher.start(config.allowPaths, (ev) => void ingestEvent(ev));
  }
  if (config.enableClipboardWatcher) {
    clipWatcher.start((ev) => void ingestEvent(ev));
  }
  if (config.enableGitWatcher) {
    gitWatcher.start(config.allowPaths, (ev) => void ingestEvent(ev));
  }
  if (config.enableActiveWindowWatcher) {
    await awWatcher.start((ev) => void ingestEvent(ev));
  }
  if (config.enableBrowserHistoryWatcher) {
    bhWatcher.start((ev) => void ingestEvent(ev));
  }
  if (config.enableClaudeSessionWatcher) {
    csWatcher.start((ev) => void ingestEvent(ev));
  }
  if (config.enableBeadsMemoryWatcher) {
    bmWatcher.start((ev) => void ingestEvent(ev));
  }
  if (config.enableClaudeTaskWatcher) {
    ctWatcher.start((ev) => void ingestEvent(ev));
  }

  // Start daemon
  const daemon = await startDaemon(config, repos);
  const stopScheduler = startScheduler(repos);

  // Build MCP server
  const server = new Server(
    { name: "threadline", version: THREADLINE_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "health",
        description: "Check Threadline daemon health, version, and enabled collectors",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_recent_threads",
        description:
          "List recent work threads. Use when the user asks 'show my threads', 'what was I doing', 'show recent work', or 'show history'.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max threads to return (default 20)" },
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
          properties: {
            threadId: { type: "string" },
            limit: { type: "number" },
          },
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
            dryRun: { type: "boolean", description: "Default true — preview only" },
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
          properties: {
            threadId: { type: "string" },
            limit: { type: "number" },
          },
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
          "List all detected projects with their threads, active status, and open commitments. Projects are grouped by working directory and git repo.",
        inputSchema: { type: "object", properties: {}, required: [] },
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
        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      logger.error(`Tool ${name} error`, err);
      return {
        content: [{ type: "text", text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Threadline MCP server started");

  const shutdown = async () => {
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
