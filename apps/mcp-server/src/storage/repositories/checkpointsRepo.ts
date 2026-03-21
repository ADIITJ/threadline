import type { Checkpoint } from "@threadline/common";
import type { IStore } from "../iStore.js";

const TABLE = "checkpoints";

export class CheckpointsRepo {
  constructor(private store: IStore) {}

  insert(cp: Checkpoint): void {
    this.store.insertUnique(TABLE, cp as unknown as Record<string, unknown>, "id");
  }

  findByThreadId(threadId: string): Checkpoint[] {
    return (this.store.find(TABLE, (r) => r.threadId === threadId) as unknown as Checkpoint[]).sort(
      (a, b) => b.ts - a.ts
    );
  }

  findRecent(limit = 10): Checkpoint[] {
    return (this.store.findAll(TABLE) as unknown as Checkpoint[])
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }

  countTotal(): number {
    return this.store.count(TABLE);
  }

  updateThreadId(cpId: string, threadId: string): void {
    this.store.updateWhere(
      TABLE,
      (r) => r.id === cpId,
      (r) => ({ ...r, threadId })
    );
  }
}
