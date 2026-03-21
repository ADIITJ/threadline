/**
 * Schema migrations for the Threadline store.
 * Each migration is idempotent and tagged with a version number.
 * Only pending migrations run on startup.
 */
import { logger } from "../logger.js";
import type { IStore } from "./iStore.js";

const CURRENT_VERSION = 3;

interface Migration {
  version: number;
  description: string;
  run: (store: IStore) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema — JsonStore creates tables dynamically",
    run: (_store) => {
      // No-op: tables are created on first insert.
    },
  },
  {
    version: 2,
    description: "Back-fill dedup_key on legacy event rows",
    run: (store) => {
      store.updateWhere(
        "events",
        (r) => !r.dedup_key,
        (r) => ({ ...r, dedup_key: `${r.source ?? "?"}:${r.contentHash ?? r.id}` })
      );
    },
  },
  {
    version: 3,
    description: "Back-fill project/projectPath on legacy thread rows",
    run: (store) => {
      store.updateWhere(
        "threads",
        (r) => r.project === undefined,
        (r) => ({ ...r, project: null, projectPath: null })
      );
    },
  },
];

export function runMigrations(store: IStore): void {
  const current = store.getSchemaVersion();
  const pending = migrations.filter((m) => m.version > current);

  if (pending.length === 0) {
    logger.debug("No pending migrations", { current, latest: CURRENT_VERSION });
    return;
  }

  for (const m of pending) {
    logger.info(`Running migration v${m.version}: ${m.description}`);
    m.run(store);
    store.setSchemaVersion(m.version);
  }

  logger.info(`Schema at v${CURRENT_VERSION}`);
}
