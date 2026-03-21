import type { ThreadlineEvent } from "@threadline/common";
import type { IStore } from "../iStore.js";

const TABLE = "events";

export class EventsRepo {
  constructor(private store: IStore) {}

  insert(event: ThreadlineEvent, threadId?: string): void {
    const row = { ...event, thread_id: threadId ?? null };
    this.store.insertUnique(TABLE, row, "id");
  }

  /**
   * Deduplicated insert: skips if same source+contentHash seen within dedupWindowMs.
   * Prevents duplicate events when multiple collectors observe the same action
   * (e.g. BrowserHistoryWatcher + browser extension both capturing the same tab visit).
   */
  insertDeduped(event: ThreadlineEvent, threadId?: string, dedupWindowMs = 60_000): boolean {
    if (event.contentHash) {
      const cutoff = event.ts - dedupWindowMs;
      const dup = this.store.findOne(
        TABLE,
        (r) =>
          r.contentHash === event.contentHash &&
          r.source === event.source &&
          (r.ts as number) >= cutoff
      );
      if (dup) return false;
    }
    const row = { ...event, thread_id: threadId ?? null };
    return this.store.insertUnique(TABLE, row, "id");
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

  findFiltered(opts: {
    source?: string;
    kind?: string;
    threadId?: string;
    sinceTs?: number;
    untilTs?: number;
    query?: string;
    limit?: number;
  }): ThreadlineEvent[] {
    const limit = opts.limit ?? 100;
    const q = opts.query?.toLowerCase();
    return this.store
      .findAll(TABLE)
      .filter((r) => {
        if (opts.source && r.source !== opts.source) return false;
        if (opts.kind && r.kind !== opts.kind) return false;
        if (opts.threadId && r.thread_id !== opts.threadId) return false;
        if (opts.sinceTs && (r.ts as number) < opts.sinceTs) return false;
        if (opts.untilTs && (r.ts as number) > opts.untilTs) return false;
        if (q) {
          const hay =
            `${r.title ?? ""} ${r.text ?? ""} ${r.path ?? ""} ${r.url ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
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

  reassignThread(fromThreadId: string, toThreadId: string): void {
    this.store.updateWhere(
      TABLE,
      (r) => r.thread_id === fromThreadId,
      (r) => ({ ...r, thread_id: toThreadId })
    );
  }

  deleteByThreadId(threadId: string): number {
    return this.store.deleteWhere(TABLE, (r) => r.thread_id === threadId);
  }

  findUnassigned(limit = 500): ThreadlineEvent[] {
    return this.store
      .find(TABLE, (r) => r.thread_id == null)
      .sort((a, b) => (a.ts as number) - (b.ts as number))
      .slice(0, limit)
      .map((r) => this.toEvent(r));
  }

  private toEvent(row: Record<string, unknown>): ThreadlineEvent {
    const { thread_id: _tid, dedup_key: _dk, ...rest } = row;
    return rest as unknown as ThreadlineEvent;
  }
}
