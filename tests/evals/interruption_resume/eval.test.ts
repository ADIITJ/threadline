import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clusterNewEvents } from "../../../apps/mcp-server/src/engine/clusterThreads.js";
import { extractCommitmentsFromEvents } from "../../../apps/mcp-server/src/engine/extractCommitments.js";
import { JsonStore } from "../../../apps/mcp-server/src/storage/jsonStore.js";
import { ArtifactsRepo } from "../../../apps/mcp-server/src/storage/repositories/artifactsRepo.js";
import { CommitmentsRepo } from "../../../apps/mcp-server/src/storage/repositories/commitmentsRepo.js";
import { EventsRepo } from "../../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "../../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { events, expectedContext } from "./fixture.js";

let tmpDir: string;
let store: JsonStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-eval-resume-"));
  store = new JsonStore(join(tmpDir, "db.json"));
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("interruption resume eval", () => {
  it("clusters all events into a single thread", async () => {
    const eventsRepo = new EventsRepo(store);
    const threadsRepo = new ThreadsRepo(store);
    const artifactsRepo = new ArtifactsRepo(store);

    for (const ev of events) eventsRepo.insert(ev);
    await clusterNewEvents(events, eventsRepo, threadsRepo, artifactsRepo);

    const threads = threadsRepo.findAll();
    expect(threads.length).toBe(1);
  });

  it("reconstructs repo context correctly", async () => {
    const eventsRepo = new EventsRepo(store);
    const threadsRepo = new ThreadsRepo(store);
    const artifactsRepo = new ArtifactsRepo(store);

    for (const ev of events) eventsRepo.insert(ev);
    await clusterNewEvents(events, eventsRepo, threadsRepo, artifactsRepo);

    const threads = threadsRepo.findAll();
    expect(threads[0].repoPaths).toContain(expectedContext.repo);
  });

  it("extracts commitments from checkpoint note", () => {
    const checkpointEvents = events.filter((e) => e.source === "checkpoint");
    const commitmentsRepo = new CommitmentsRepo(store);
    const threadId = "test-thread";
    const commitments = extractCommitmentsFromEvents(checkpointEvents, threadId);
    expect(commitments.length).toBeGreaterThan(0);
    expect(
      commitments.some((c) => c.text.toLowerCase().includes(expectedContext.commitmentKeyword))
    ).toBe(true);
  });
});
