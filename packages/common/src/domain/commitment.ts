export type CommitmentStatus = "open" | "done" | "unknown";

export interface Commitment {
  id: string;
  threadId: string;
  text: string;
  owner: string;
  dueDate?: string;
  status: CommitmentStatus;
  evidenceEventIds: string[];
  confidence: number;
  metadata: Record<string, unknown>;
}
