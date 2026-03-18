import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonStore } from "../../apps/mcp-server/src/storage/jsonStore.js";
import { CleanupRepo } from "../../apps/mcp-server/src/storage/repositories/cleanupRepo.js";

let tmpDir: string;
let store: JsonStore;
let cleanupRepo: CleanupRepo;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-test-"));
  store = new JsonStore(join(tmpDir, "test.json"));
  cleanupRepo = new CleanupRepo(store);
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("CleanupRepo", () => {
  it("inserts and retrieves a manifest", () => {
    const manifest = {
      id: "test-manifest",
      ts: Date.now(),
      sourceDir: "/tmp/Downloads",
      quarantineDir: "/tmp/quarantine/test-manifest",
      items: [
        {
          from: "/tmp/Downloads/file.txt",
          to: "/tmp/quarantine/test-manifest/file.txt",
          hash: "abc123",
        },
      ],
      reason: "test cleanup",
      restored: false,
    };
    cleanupRepo.insert(manifest);
    const found = cleanupRepo.findLatestUnrestored();
    expect(found).not.toBeNull();
    expect(found?.id).toBe("test-manifest");
  });

  it("marks manifest as restored", () => {
    const manifest = {
      id: "restore-test",
      ts: Date.now(),
      sourceDir: "/tmp/Downloads",
      quarantineDir: "/tmp/q/restore-test",
      items: [],
      reason: "test",
      restored: false,
    };
    cleanupRepo.insert(manifest);
    cleanupRepo.markRestored("restore-test");
    expect(cleanupRepo.findLatestUnrestored()).toBeNull();
  });

  it("returns null when no unrestored manifest", () => {
    expect(cleanupRepo.findLatestUnrestored()).toBeNull();
  });

  it("returns most recent unrestored when multiple exist", () => {
    cleanupRepo.insert({
      id: "old",
      ts: 1000,
      sourceDir: "/d",
      quarantineDir: "/q/old",
      items: [],
      reason: "",
      restored: false,
    });
    cleanupRepo.insert({
      id: "new",
      ts: 2000,
      sourceDir: "/d",
      quarantineDir: "/q/new",
      items: [],
      reason: "",
      restored: false,
    });
    const found = cleanupRepo.findLatestUnrestored();
    expect(found?.id).toBe("new");
  });
});
