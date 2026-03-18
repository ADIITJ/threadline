import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clusterNewEvents } from "../../apps/mcp-server/src/engine/clusterThreads.js";
import { JsonStore } from "../../apps/mcp-server/src/storage/jsonStore.js";
import { ArtifactsRepo } from "../../apps/mcp-server/src/storage/repositories/artifactsRepo.js";
import { CheckpointsRepo } from "../../apps/mcp-server/src/storage/repositories/checkpointsRepo.js";
import { CommitmentsRepo } from "../../apps/mcp-server/src/storage/repositories/commitmentsRepo.js";
import { EventsRepo } from "../../apps/mcp-server/src/storage/repositories/eventsRepo.js";
import { ThreadsRepo } from "../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { toolGetThreadDetails } from "../../apps/mcp-server/src/tools/getThreadDetails.js";
import { toolGetThreadTimeline } from "../../apps/mcp-server/src/tools/getThreadTimeline.js";
import { toolListRecentThreads } from "../../apps/mcp-server/src/tools/listRecentThreads.js";
import { generateId } from "../../apps/mcp-server/src/utils/hashing.js";
import type { ThreadlineEvent } from "../../packages/common/src/index.js";

let tmpDir: string;
let store: JsonStore;
let repos: {
  events: EventsRepo;
  threads: ThreadsRepo;
  artifacts: ArtifactsRepo;
  commitments: CommitmentsRepo;
  checkpoints: CheckpointsRepo;
};

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-listing-"));
  store = new JsonStore(join(tmpDir, "db.json"));
  repos = {
    events: new EventsRepo(store),
    threads: new ThreadsRepo(store),
    artifacts: new ArtifactsRepo(store),
    commitments: new CommitmentsRepo(store),
    checkpoints: new CheckpointsRepo(store),
  };

  // Seed some events
  const baseTs = Date.now() - 3600000;
  const events: ThreadlineEvent[] = [
    {
      id: generateId("ev"),
      ts: baseTs,
      source: "filesystem",
      kind: "modified",
      actor: "user",
      title: "auth.ts",
      text: "",
      path: "/projects/myapp/src/auth.ts",
      repoPath: "/projects/myapp",
      tags: [],
      entities: [],
      metadata: {},
    },
    {
      id: generateId("ev"),
      ts: baseTs + 300000,
      source: "git",
      kind: "committed",
      actor: "user",
      title: "fix: oauth callback",
      text: "",
      repoPath: "/projects/myapp",
      tags: [],
      entities: [],
      metadata: {},
    },
  ];

  for (const ev of events) repos.events.insert(ev);
  await clusterNewEvents(events, repos.events, repos.threads, repos.artifacts);
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("toolListRecentThreads", () => {
  it("returns threads with counts", async () => {
    const result = await toolListRecentThreads({}, repos);
    expect(result.threads.length).toBeGreaterThan(0);
    expect(result.threads[0]).toHaveProperty("id");
    expect(result.threads[0]).toHaveProperty("artifactCount");
    expect(result.threads[0]).toHaveProperty("commitmentCount");
  });

  it("returns formatted markdown", async () => {
    const result = await toolListRecentThreads({ limit: 5 }, repos);
    expect(result.formatted).toContain("##");
  });
});

describe("toolGetThreadDetails", () => {
  it("returns thread details with timeline", async () => {
    const threads = repos.threads.findAll();
    const threadId = threads[0].id;
    const result = await toolGetThreadDetails({ threadId }, repos);
    expect(result).toHaveProperty("thread");
    expect(result).toHaveProperty("timeline");
    expect(result).toHaveProperty("artifacts");
  });

  it("returns error for unknown thread", async () => {
    const result = await toolGetThreadDetails({ threadId: "nonexistent" }, repos);
    expect(result).toHaveProperty("error");
  });
});

describe("toolGetThreadTimeline", () => {
  it("returns formatted timeline", async () => {
    const threads = repos.threads.findAll();
    const threadId = threads[0].id;
    const result = await toolGetThreadTimeline({ threadId }, repos);
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("formatted");
    expect((result as { formatted: string }).formatted).toContain("Timeline");
  });
});
