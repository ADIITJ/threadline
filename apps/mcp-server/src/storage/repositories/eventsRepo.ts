import type { ThreadlineEvent } from "@threadline/common";
import type { JsonStore } from "../jsonStore.js";

const TABLE = "events";

export class EventsRepo {
  constructor(private store: JsonStore) {}

  insert(event: ThreadlineEvent, threadId?: string): void {
    const row = { ...event, thread_id: threadId ?? null };
    this.store.insertUnique(TABLE, row, "id");
  }

  findById(id: string): ThreadlineEvent | null {
    const row = this.store.findOne(TABLE, (r) => r.id === id);
    return row ? this.toEvent(row) : null;
  }

  findByThreadId(threadId: string, limit = 200): ThreadlineEvent[] {
    return this.store
      .find(TABLE, (r) => r.thread_id === threadId)
      .sort((a, b) => (b.ts as number) - (a.ts as number))
      .slice(0, limit)
      .map((r) => this.toEvent(r));
  }

  findRecent(limit = 100, sinceTs?: number): ThreadlineEvent[] {
    const all = this.store.findAll(TABLE);
    const filtered = sinceTs ? all.filter((r) => (r.ts as number) >= sinceTs) : all;
    return filtered
      .sort((a, b) => (b.ts as number) - (a.ts as number))
      .slice(0, limit)
      .map((r) => this.toEvent(r));
  }

  countTotal(): number {
    return this.store.count(TABLE);
  }

  updateThreadId(eventId: string, threadId: string): void {
    this.store.updateWhere(
      TABLE,
      (r) => r.id === eventId,
      (r) => ({ ...r, thread_id: threadId })
    );
  }

  findUnassigned(limit = 500): ThreadlineEvent[] {
    return this.store
      .find(TABLE, (r) => r.thread_id == null)
      .sort((a, b) => (a.ts as number) - (b.ts as number))
      .slice(0, limit)
      .map((r) => this.toEvent(r));
  }

  private toEvent(row: Record<string, unknown>): ThreadlineEvent {
    const { thread_id: _tid, ...rest } = row;
    return rest as unknown as ThreadlineEvent;
  }
}
