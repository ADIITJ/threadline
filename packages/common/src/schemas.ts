import { z } from "zod";

export const EventSourceSchema = z.enum([
  "filesystem",
  "clipboard",
  "git",
  "browser",
  "checkpoint",
  "active_window",
  "system",
]);

export const EventKindSchema = z.enum([
  "created",
  "modified",
  "deleted",
  "opened",
  "copied",
  "committed",
  "branch_changed",
  "tab_opened",
  "tab_closed",
  "tab_updated",
  "checkpoint_created",
  "cleanup_moved",
  "cleanup_restored",
  "note",
]);

export const ThreadlineEventSchema = z.object({
  id: z.string().min(1),
  ts: z.number().int().positive(),
  source: EventSourceSchema,
  kind: EventKindSchema,
  actor: z.string().default("user"),
  title: z.string().default(""),
  text: z.string().default(""),
  path: z.string().optional(),
  repoPath: z.string().optional(),
  url: z.string().optional(),
  hostname: z.string().optional(),
  ext: z.string().optional(),
  tags: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  threadCandidateKey: z.string().optional(),
  contentHash: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const ThreadStateSchema = z.enum(["active", "waiting", "blocked", "stale", "archived"]);

export const ThreadSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  state: ThreadStateSchema,
  firstSeenTs: z.number().int().positive(),
  lastSeenTs: z.number().int().positive(),
  score: z.number().min(0).max(1),
  signature: z.string(),
  entityBag: z.array(z.string()).default([]),
  artifactIds: z.array(z.string()).default([]),
  repoPaths: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),
  checkpointIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const ArtifactTypeSchema = z.enum(["file", "url", "repo", "clipboard", "note"]);

export const ArtifactSchema = z.object({
  id: z.string().min(1),
  type: ArtifactTypeSchema,
  locator: z.string(),
  title: z.string(),
  contentHash: z.string().optional(),
  firstSeenTs: z.number().int().positive(),
  lastSeenTs: z.number().int().positive(),
  metadata: z.record(z.unknown()).default({}),
});

export const CommitmentStatusSchema = z.enum(["open", "done", "unknown"]);

export const CommitmentSchema = z.object({
  id: z.string().min(1),
  threadId: z.string(),
  text: z.string(),
  owner: z.string().default("user"),
  dueDate: z.string().optional(),
  status: CommitmentStatusSchema.default("open"),
  evidenceEventIds: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).default({}),
});

export const CheckpointSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().optional(),
  ts: z.number().int().positive(),
  title: z.string(),
  note: z.string().default(""),
  artifactIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const CleanupItemSchema = z.object({
  from: z.string(),
  to: z.string(),
  hash: z.string(),
});

export const CleanupManifestSchema = z.object({
  id: z.string().min(1),
  ts: z.number().int().positive(),
  sourceDir: z.string(),
  quarantineDir: z.string(),
  items: z.array(CleanupItemSchema),
  reason: z.string(),
  restored: z.boolean().default(false),
});

export const BrowserEventPayloadSchema = z.object({
  tabId: z.number(),
  windowId: z.number(),
  url: z.string().url(),
  title: z.string(),
  kind: z.enum(["tab_opened", "tab_closed", "tab_updated"]),
  ts: z.number().optional(),
  incognito: z.boolean().optional(),
});

export const CheckpointPayloadSchema = z.object({
  title: z.string().min(1),
  note: z.string().optional(),
  paths: z.array(z.string()).optional(),
  urls: z.array(z.string()).optional(),
});

export type ThreadlineEventInput = z.input<typeof ThreadlineEventSchema>;
export type BrowserEventPayload = z.infer<typeof BrowserEventPayloadSchema>;
export type CheckpointPayload = z.infer<typeof CheckpointPayloadSchema>;
