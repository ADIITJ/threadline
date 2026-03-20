import type {
  Artifact,
  Checkpoint,
  CleanupManifest,
  Commitment,
  Thread,
  ThreadlineEvent,
} from "@threadline/common";

export interface ThreadlineConfig {
  homeDir: string;
  daemonPort: number;
  enableBrowserIngest: boolean;
  enableClipboardWatcher: boolean;
  enableFilesystemWatcher: boolean;
  enableGitWatcher: boolean;
  enableActiveWindowWatcher: boolean;
  enableBrowserHistoryWatcher: boolean;
  allowPaths: string[];
  denyPaths: string[];
  ignorePrivateBrowser: boolean;
  autoArchiveThresholdDays: number;
  downloadCleanupThreshold: number;
  maxStoredClipboardChars: number;
  openCommand?: string;
}

export interface RecentCounts {
  events: number;
  threads: number;
  commitments: number;
  checkpoints: number;
}

export interface ThreadWithCounts extends Thread {
  artifactCount: number;
  commitmentCount: number;
}

export interface ThreadDetails {
  thread: Thread;
  timeline: ThreadlineEvent[];
  artifacts: Artifact[];
  commitments: Commitment[];
  checkpoints: Checkpoint[];
  relatedThreads: ThreadWithCounts[];
}

export interface HandoffDoc {
  title: string;
  executiveSummary: string;
  timeline: ThreadlineEvent[];
  openQuestions: string[];
  commitments: Commitment[];
  artifacts: Artifact[];
  nextSteps: string[];
}

export interface ResumeCard {
  thread: Thread;
  summaryCard: string;
  commitments: Commitment[];
  suggestedActions: string[];
  artifacts: Artifact[];
}

export interface CleanupPreview {
  manifestPreview?: CleanupManifestPreview;
  manifest?: CleanupManifest;
  movedCount: number;
  quarantineDir: string;
  undoToken: string;
}

export interface CleanupManifestPreview {
  candidateCount: number;
  totalBytes: number;
  files: Array<{ path: string; sizeBytes: number; ageDays: number; reason: string }>;
}

export interface SearchMatch {
  thread: Thread;
  score: number;
  highlights: string[];
}

export interface CommitmentsResult {
  commitments: Commitment[];
  groupedByThread: Record<string, { thread: Thread; commitments: Commitment[] }>;
}

export interface OpenArtifactsResult {
  attempted: number;
  opened: string[];
  skipped: string[];
  notes: string[];
}

export interface UndoResult {
  restored: boolean;
  restoredCount: number;
  conflicts: string[];
  manifest: CleanupManifest | null;
}
