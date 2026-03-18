import type { CleanupManifest } from "@threadline/common";
import type { JsonStore } from "../jsonStore.js";

const TABLE = "cleanup_manifests";

export class CleanupRepo {
  constructor(private store: JsonStore) {}

  insert(manifest: CleanupManifest): void {
    this.store.insertUnique(TABLE, manifest as unknown as Record<string, unknown>, "id");
  }

  findLatestUnrestored(): CleanupManifest | null {
    const rows = this.store.find(TABLE, (r) => !r.restored) as unknown as CleanupManifest[];
    if (rows.length === 0) return null;
    return rows.sort((a, b) => b.ts - a.ts)[0];
  }

  markRestored(id: string): void {
    this.store.updateWhere(
      TABLE,
      (r) => r.id === id,
      (r) => ({ ...r, restored: true })
    );
  }

  findById(id: string): CleanupManifest | null {
    const row = this.store.findOne(TABLE, (r) => r.id === id);
    return row ? (row as unknown as CleanupManifest) : null;
  }
}
