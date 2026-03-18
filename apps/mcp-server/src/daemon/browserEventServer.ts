import type { ThreadlineEvent } from "@threadline/common";
import { BrowserEventPayloadSchema } from "@threadline/common";
import type { FastifyInstance } from "fastify";
import { clusterNewEvents } from "../engine/clusterThreads.js";
import { writeAudit } from "../storage/auditLog.js";
import type { ArtifactsRepo } from "../storage/repositories/artifactsRepo.js";
import type { CheckpointsRepo } from "../storage/repositories/checkpointsRepo.js";
import type { CommitmentsRepo } from "../storage/repositories/commitmentsRepo.js";
import type { EventsRepo } from "../storage/repositories/eventsRepo.js";
import type { ThreadsRepo } from "../storage/repositories/threadsRepo.js";
import type { ThreadlineConfig } from "../types.js";
import { generateId } from "../utils/hashing.js";
import { extractEntities } from "../utils/text.js";
import { extractHostname } from "../utils/urls.js";

const IGNORED_URL_PREFIXES = ["chrome://", "chrome-extension://", "about:", "moz-extension://"];

export function registerBrowserEventRoutes(
  app: FastifyInstance,
  repos: {
    events: EventsRepo;
    threads: ThreadsRepo;
    artifacts: ArtifactsRepo;
    commitments: CommitmentsRepo;
    checkpoints: CheckpointsRepo;
  },
  config: ThreadlineConfig
): void {
  app.post("/ingest/browser-event", async (req, reply) => {
    const parsed = BrowserEventPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const payload = parsed.data;

    if (!config.enableBrowserIngest) {
      return reply.status(200).send({ accepted: false, reason: "browser_ingest_disabled" });
    }

    if (payload.incognito && config.ignorePrivateBrowser) {
      return reply.status(200).send({ accepted: false, reason: "incognito_ignored" });
    }

    for (const prefix of IGNORED_URL_PREFIXES) {
      if (payload.url.startsWith(prefix)) {
        return reply.status(200).send({ accepted: false, reason: "ignored_url" });
      }
    }

    const event: ThreadlineEvent = {
      id: generateId("br"),
      ts: payload.ts ?? Date.now(),
      source: "browser",
      kind: payload.kind,
      actor: "user",
      title: payload.title,
      text: "",
      url: payload.url,
      hostname: extractHostname(payload.url),
      tags: [],
      entities: extractEntities(`${payload.title} ${payload.url}`),
      metadata: { tabId: payload.tabId, windowId: payload.windowId },
    };

    repos.events.insert(event);
    writeAudit({ action: "browser_event_ingested", actor: "browser", subject: payload.url });

    await clusterNewEvents([event], repos.events, repos.threads, repos.artifacts);

    return reply.status(201).send({ accepted: true, eventId: event.id });
  });
}
