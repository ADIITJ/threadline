import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonStore } from "../../../apps/mcp-server/src/storage/jsonStore.js";
import { CleanupRepo } from "../../../apps/mcp-server/src/storage/repositories/cleanupRepo.js";
import { ThreadsRepo } from "../../../apps/mcp-server/src/storage/repositories/threadsRepo.js";
import { toolUndoLastCleanup } from "../../../apps/mcp-server/src/tools/undoLastCleanup.js";

let tmpDir: string;
let store: JsonStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "threadline-cleanup-eval-"));
  store = new JsonStore(join(tmpDir, "db.json"));
});

afterEach(() => {
  store.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("downloads cleanup eval", () => {
  it("undo restores files to original paths", async () => {
    const cleanupRepo = new CleanupRepo(store);

    const sourceDir = join(tmpDir, "downloads");
    const quarantineDir = join(tmpDir, "quarantine", "test");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(quarantineDir, { recursive: true });

    const originalPath = join(sourceDir, "test-file.pdf");
    const quarantinedPath = join(quarantineDir, "test-file.pdf");
    writeFileSync(quarantinedPath, "test content");

    cleanupRepo.insert({
      id: "test-cleanup",
      ts: Date.now(),
      sourceDir,
      quarantineDir,
      items: [{ from: originalPath, to: quarantinedPath, hash: "abc" }],
      reason: "test",
      restored: false,
    });

    const result = await toolUndoLastCleanup({}, cleanupRepo);
    expect(result.restored).toBe(true);
    expect(result.restoredCount).toBe(1);
    expect(existsSync(originalPath)).toBe(true);
    expect(existsSync(quarantinedPath)).toBe(false);
  });

  it("handles conflict when original path is occupied", async () => {
    const cleanupRepo = new CleanupRepo(store);

    const sourceDir = join(tmpDir, "downloads2");
    const quarantineDir = join(tmpDir, "quarantine", "test2");
    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(quarantineDir, { recursive: true });

    const originalPath = join(sourceDir, "conflict-file.pdf");
    const quarantinedPath = join(quarantineDir, "conflict-file.pdf");

    // Both paths exist — simulate conflict
    writeFileSync(originalPath, "new content at original");
    writeFileSync(quarantinedPath, "quarantined content");

    cleanupRepo.insert({
      id: "conflict-cleanup",
      ts: Date.now(),
      sourceDir,
      quarantineDir,
      items: [{ from: originalPath, to: quarantinedPath, hash: "def" }],
      reason: "test conflict",
      restored: false,
    });

    const result = await toolUndoLastCleanup({}, cleanupRepo);
    expect(result.restored).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("returns not restored when no manifests exist", async () => {
    const cleanupRepo = new CleanupRepo(store);
    const result = await toolUndoLastCleanup({}, cleanupRepo);
    expect(result.restored).toBe(false);
    expect(result.restoredCount).toBe(0);
  });
});
