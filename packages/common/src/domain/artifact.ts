export type ArtifactType = "file" | "url" | "repo" | "clipboard" | "note";

export interface Artifact {
  id: string;
  type: ArtifactType;
  locator: string;
  title: string;
  contentHash?: string;
  firstSeenTs: number;
  lastSeenTs: number;
  metadata: Record<string, unknown>;
}
