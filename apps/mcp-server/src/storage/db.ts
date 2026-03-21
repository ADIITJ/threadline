import { join } from "node:path";
import { logger } from "../logger.js";
import type { IStore } from "./iStore.js";
import { JsonStore } from "./jsonStore.js";
import { runMigrations } from "./migrations.js";

let _store: IStore | null = null;

export function getDb(homeDir: string): IStore {
  if (_store) return _store;
  const dbPath = join(homeDir, "data", "threadline.json");
  _store = new JsonStore(dbPath);
  runMigrations(_store);
  logger.info("Store initialized", { path: dbPath });
  return _store;
}

export function closeDb(): void {
  if (_store) {
    _store.close();
    _store = null;
  }
}

export function resetDb(): void {
  closeDb();
}
