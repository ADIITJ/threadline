import type { Artifact } from "@threadline/common";
import type { IStore } from "../iStore.js";

const TABLE = "artifacts";
const LINK_TABLE = "thread_artifacts";

interface ThreadArtifactLink {
  thread_id: string;
  artifact_id: string;
}

export class ArtifactsRepo {
  constructor(private store: IStore) {}

  upsert(artifact: Artifact): void {
    this.store.upsert(TABLE, artifact as unknown as Record<string, unknown>, "id");
    // Also maintain locator uniqueness
    this.store.updateWhere(
      TABLE,
      (r) => r.locator === artifact.locator && r.id !== artifact.id,
      (r) => ({ ...r, lastSeenTs: artifact.lastSeenTs, title: artifact.title })
    );
  }

  findById(id: string): Artifact | null {
    const row = this.store.findOne(TABLE, (r) => r.id === id);
    return row ? (row as unknown as Artifact) : null;
  }

  findByLocator(locator: string): Artifact | null {
    const row = this.store.findOne(TABLE, (r) => r.locator === locator);
    return row ? (row as unknown as Artifact) : null;
  }

  findByThreadId(threadId: string): Artifact[] {
    const links = this.store.find(
      LINK_TABLE,
      (r) => r.thread_id === threadId
    ) as unknown as ThreadArtifactLink[];
    const artifactIds = new Set(links.map((l) => l.artifact_id));
    return (this.store.findAll(TABLE) as unknown as Artifact[])
      .filter((a) => artifactIds.has(a.id))
      .sort((a, b) => b.lastSeenTs - a.lastSeenTs);
  }

  linkToThread(artifactId: string, threadId: string): void {
    const exists = this.store.findOne(
      LINK_TABLE,
      (r) => r.thread_id === threadId && r.artifact_id === artifactId
    );
    if (!exists) {
      this.store.insert(LINK_TABLE, { thread_id: threadId, artifact_id: artifactId });
    }
  }

  unlinkFromThread(threadId: string): void {
    this.store.deleteWhere(LINK_TABLE, (r) => r.thread_id === threadId);
  }

  relinkToThread(fromThreadId: string, toThreadId: string): void {
    this.store.updateWhere(
      LINK_TABLE,
      (r) => r.thread_id === fromThreadId,
      (r) => ({ ...r, thread_id: toThreadId })
    );
  }

  countByThread(threadId: string): number {
    return this.store.count(LINK_TABLE, (r) => r.thread_id === threadId);
  }
}
