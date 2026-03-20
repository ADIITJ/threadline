export type EventSource =
  | "filesystem"
  | "clipboard"
  | "git"
  | "browser"
  | "checkpoint"
  | "active_window"
  | "system";

export type EventKind =
  | "created"
  | "modified"
  | "deleted"
  | "opened"
  | "copied"
  | "committed"
  | "branch_changed"
  | "tab_opened"
  | "tab_closed"
  | "tab_updated"
  | "tab_visited"
  | "checkpoint_created"
  | "cleanup_moved"
  | "cleanup_restored"
  | "note";

export interface ThreadlineEvent {
  id: string;
  ts: number;
  source: EventSource;
  kind: EventKind;
  actor: string;
  title: string;
  text: string;
  path?: string;
  repoPath?: string;
  url?: string;
  hostname?: string;
  ext?: string;
  tags: string[];
  entities: string[];
  threadCandidateKey?: string;
  contentHash?: string;
  metadata: Record<string, unknown>;
}
