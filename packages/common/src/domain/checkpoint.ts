export interface Checkpoint {
  id: string;
  threadId?: string;
  ts: number;
  title: string;
  note: string;
  artifactIds: string[];
  metadata: Record<string, unknown>;
}
