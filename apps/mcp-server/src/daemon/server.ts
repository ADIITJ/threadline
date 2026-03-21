import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { THREADLINE_VERSION } from "@threadline/common";
import Fastify from "fastify";
import { logger } from "../logger.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import { toolImportThread } from "../tools/importThread.js";
import type { ThreadlineConfig } from "../types.js";
import { registerBrowserEventRoutes } from "./browserEventServer.js";
import { registerIngestRoutes } from "./ingestRoutes.js";

// Resolve ui.html relative to this compiled file (dist/daemon/ui.html)
const UI_HTML_PATH = join(__dirname, "ui.html");

function loadUiHtml(): string {
  if (existsSync(UI_HTML_PATH)) return readFileSync(UI_HTML_PATH, "utf-8");
  return "<html><body><p>Threadline UI not found. Run <code>pnpm build</code>.</p></body></html>";
}

export async function startDaemon(
  config: ThreadlineConfig,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  }
): Promise<{ stop: () => Promise<void> }> {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    ok: true,
    version: THREADLINE_VERSION,
    ts: Date.now(),
  }));

  app.get("/config/public", async () => ({
    daemonPort: config.daemonPort,
    enableBrowserIngest: config.enableBrowserIngest,
    ignorePrivateBrowser: config.ignorePrivateBrowser,
  }));

  app.get("/threads/recent", async (req) => {
    const limit = Number((req.query as Record<string, string>).limit ?? "10");
    return { threads: repos.threads.findRecent(Math.min(limit, 50)) };
  });

  // Local web UI (Issue 10)
  app.get("/ui", async (_req, reply) => {
    reply.type("text/html").send(loadUiHtml());
  });

  // Thread import endpoint — enables team/shared mode (Issue 11)
  app.post("/api/import-thread", async (req, reply) => {
    const body = req.body as { data?: string };
    if (!body?.data) {
      reply.code(400);
      return { ok: false, error: "Missing data field" };
    }
    return toolImportThread({ data: body.data }, repos);
  });

  registerIngestRoutes(app, repos, config);
  registerBrowserEventRoutes(app, repos, config);

  try {
    await app.listen({ port: config.daemonPort, host: "127.0.0.1" });
    logger.info(`Daemon listening on http://127.0.0.1:${config.daemonPort}`);
  } catch (err) {
    logger.warn("Daemon could not start (port may be in use)", err);
  }

  return {
    stop: async () => {
      await app.close();
    },
  };
}
