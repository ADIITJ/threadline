import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clusterNewEvents } from "../../apps/mcp-server/src/engine/clusterThreads.js";
import { JsonStore } from "../../apps/mcp-server/src/storage/jsonStore.js";
import { ArtifactsRepo } from "../../apps/mcp-server/src/storage/repositories/artifactsRepo.js";
import { EventsRepo } from "../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { generateId } from "../../apps/mcp-server/src/utils/hashing.js";
import type { ThreadlineEvent } from "../../packages/common/src/index.js";

let tmpDir: string;
let store: JsonStore;
let eventsRepo: EventsRepo;
let threadsRepo: ThreadsRepo;
let artifactsRepo: ArtifactsRepo;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-integration-"));
  store = new JsonStore(join(tmpDir, "db.json"));
  eventsRepo = new EventsRepo(store);
  threadsRepo = new ThreadsRepo(store);
  artifactsRepo = new ArtifactsRepo(store);
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("browser event ingestion", () => {
  it("ingests browser events and creates a thread", async () => {
    const event: ThreadlineEvent = {
      id: generateId("br"),
      ts: Date.now(),
      source: "browser",
      kind: "tab_opened",
      actor: "user",
      title: "GitHub - acme/widget-service",
      text: "",
      url: "https://github.com/acme/widget-service",
      hostname: "github.com",
      tags: [],
      entities: [],
      metadata: {},
    };

    eventsRepo.insert(event);
    await clusterNewEvents([event], eventsRepo, threadsRepo, artifactsRepo);

    const threads = threadsRepo.findAll();
    expect(threads.length).toBeGreaterThan(0);

    const thread = threads[0];
    expect(thread.urls).toContain("https://github.com/acme/widget-service");
  });

  it("clusters related browser events into same thread", async () => {
    const baseTs = Date.now();
    const events: ThreadlineEvent[] = [
      {
        id: generateId("br"),
        ts: baseTs,
        source: "browser",
        kind: "tab_opened",
        actor: "user",
        title: "PR #42 - widget-service",
        text: "",
        url: "https://github.com/acme/widget-service/pull/42",
        hostname: "github.com",
        tags: [],
        entities: [],
        metadata: {},
      },
      {
        id: generateId("br"),
        ts: baseTs + 60000,
        source: "browser",
        kind: "tab_updated",
        actor: "user",
        title: "Code review - widget-service",
        text: "",
        url: "https://github.com/acme/widget-service/pull/42/files",
        hostname: "github.com",
        tags: [],
        entities: [],
        metadata: {},
      },
    ];

    for (const ev of events) eventsRepo.insert(ev);
    await clusterNewEvents(events, eventsRepo, threadsRepo, artifactsRepo);

    const threads = threadsRepo.findAll();
    expect(threads.length).toBe(1);
  });
});
