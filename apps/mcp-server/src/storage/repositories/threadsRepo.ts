import type { Thread } from "@threadline/common";
import type { IStore } from "../iStore.js";

const TABLE = "threads";

export class ThreadsRepo {
  constructor(private store: IStore) {}

  upsert(thread: Thread): void {
    this.store.upsert(TABLE, thread as unknown as Record<string, unknown>, "id");
  }

  findById(id: string): Thread | null {
    const row = this.store.findOne(TABLE, (r) => r.id === id);
    return row ? (row as unknown as Thread) : null;
  }

  findRecent(limit = 20, state?: Thread["state"]): Thread[] {
    const all = this.store.findAll(TABLE) as unknown as Thread[];
    const filtered = state
      ? all.filter((t) => t.state === state)
      : all.filter((t) => t.state !== "archived");
    return filtered.sort((a, b) => b.lastSeenTs - a.lastSeenTs).slice(0, limit);
  }

  findAll(limit = 100): Thread[] {
    return (this.store.findAll(TABLE) as unknown as Thread[])
      .sort((a, b) => b.lastSeenTs - a.lastSeenTs)
      .slice(0, limit);
  }

  countTotal(): number {
    return this.store.count(TABLE);
  }

  updateState(threadId: string, state: Thread["state"]): void {
    this.store.updateWhere(
      TABLE,
      (r) => r.id === threadId,
      (r) => ({ ...r, state })
    );
  }

  findBySignatureTokens(tokens: string[], limit = 10): Thread[] {
    const rows = this.store.find(TABLE, (r) => (r as unknown as Thread).state !== "archived");
    const threads = rows as unknown as Thread[];
    return threads
      .filter((t) => tokens.some((tok) => t.signature.includes(tok)))
      .sort((a, b) => b.lastSeenTs - a.lastSeenTs)
      .slice(0, limit);
  }
}
