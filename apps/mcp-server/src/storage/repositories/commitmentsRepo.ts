import type { Commitment } from "@threadline/common";
import type { JsonStore } from "../jsonStore.js";

const TABLE = "commitments";

export class CommitmentsRepo {
  constructor(private store: JsonStore) {}

  insert(commitment: Commitment): void {
    this.store.insertUnique(TABLE, commitment as unknown as Record<string, unknown>, "id");
  }

  findByThreadId(threadId: string): Commitment[] {
    return this.store.find(TABLE, (r) => r.threadId === threadId) as unknown as Commitment[];
  }

  findAll(opts: {
    status?: Commitment["status"];
    owner?: string;
    dueBefore?: string;
    limit?: number;
  }): Commitment[] {
    let rows = this.store.findAll(TABLE) as unknown as Commitment[];

    if (opts.status) rows = rows.filter((c) => c.status === opts.status);
    if (opts.owner) rows = rows.filter((c) => c.owner === opts.owner);
    if (opts.dueBefore) {
      const dueBefore = opts.dueBefore;
      rows = rows.filter((c) => c.dueDate != null && c.dueDate <= dueBefore);
    }

    return rows.slice(0, opts.limit ?? 50);
  }

  countByThread(threadId: string): number {
    return this.store.count(TABLE, (r) => r.threadId === threadId);
  }

  countTotal(): number {
    return this.store.count(TABLE);
  }
}
