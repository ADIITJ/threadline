export type ThreadState = "active" | "waiting" | "blocked" | "stale" | "archived";

export interface Thread {
  id: string;
  title: string;
  summary: string;
  state: ThreadState;
  firstSeenTs: number;
  lastSeenTs: number;
  score: number;
  signature: string;
  entityBag: string[];
  artifactIds: string[];
  repoPaths: string[];
  urls: string[];
  checkpointIds: string[];
  project?: string;
  projectPath?: string;
  metadata: Record<string, unknown>;
}
