import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCheckpoint } from "../../apps/mcp-server/src/collectors/manualCheckpoint.js";
import { clusterNewEvents } from "../../apps/mcp-server/src/engine/clusterThreads.js";
import { JsonStore } from "../../apps/mcp-server/src/storage/jsonStore.js";
import { ArtifactsRepo } from "../../apps/mcp-server/src/storage/repositories/artifactsRepo.js";
import { CheckpointsRepo } from "../../apps/mcp-server/src/storage/repositories/checkpointsRepo.js";
import { CommitmentsRepo } from "../../apps/mcp-server/src/storage/repositories/commitmentsRepo.js";
import { EventsRepo } from "../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "../../apps/mcp-server/src/storage/repositories/threadsRepo.js";

let tmpDir: string;
let store: JsonStore;
let eventsRepo: EventsRepo;
let threadsRepo: ThreadsRepo;
let artifactsRepo: ArtifactsRepo;
let commitmentsRepo: CommitmentsRepo;
let checkpointsRepo: CheckpointsRepo;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-cp-"));
  store = new JsonStore(join(tmpDir, "db.json"));
  eventsRepo = new EventsRepo(store);
  threadsRepo = new ThreadsRepo(store);
  artifactsRepo = new ArtifactsRepo(store);
  commitmentsRepo = new CommitmentsRepo(store);
  checkpointsRepo = new CheckpointsRepo(store);
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("checkpoint creation", () => {
  it("creates a checkpoint and extracts commitments from note", async () => {
    const result = await createCheckpoint(
      {
        title: "Pre-deploy check",
        note: "TODO: update the migration script. I will notify the team after deploy.",
        paths: ["/projects/api/migrations"],
      },
      eventsRepo,
      checkpointsRepo,
      commitmentsRepo
    );

    expect(result.checkpoint.title).toBe("Pre-deploy check");
    expect(result.commitments.length).toBeGreaterThan(0);

    const recent = checkpointsRepo.findRecent(5);
    expect(recent.some((c) => c.id === result.checkpoint.id)).toBe(true);
  });

  it("links checkpoint to thread on cluster", async () => {
    const { event } = await createCheckpoint(
      { title: "Work session start", note: "Starting work on oauth refactor" },
      eventsRepo,
      checkpointsRepo,
      commitmentsRepo
    );

    await clusterNewEvents([event], eventsRepo, threadsRepo, artifactsRepo);

    const threads = threadsRepo.findAll();
    expect(threads.length).toBeGreaterThan(0);
  });
});
