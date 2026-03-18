export interface CleanupItem {
  from: string;
  to: string;
  hash: string;
}

export interface CleanupManifest {
  id: string;
  ts: number;
  sourceDir: string;
  quarantineDir: string;
  items: CleanupItem[];
  reason: string;
  restored: boolean;
}
