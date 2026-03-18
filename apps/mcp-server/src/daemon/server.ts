import { THREADLINE_VERSION } from "@threadline/common";
import Fastify from "fastify";
import { logger } from "../logger.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import type { ThreadlineConfig } from "../types.js";
import { registerBrowserEventRoutes } from "./browserEventServer.js";
import { registerIngestRoutes } from "./ingestRoutes.js";

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
