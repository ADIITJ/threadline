import { join } from "node:path";
import { logger } from "../logger.js";
import { JsonStore } from "./jsonStore.js";

let _store: JsonStore | null = null;

export function getDb(homeDir: string): JsonStore {
  if (_store) return _store;
  const dbPath = join(homeDir, "data", "threadline.json");
  _store = new JsonStore(dbPath);
  logger.info("JSON store initialized", { path: dbPath });
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
