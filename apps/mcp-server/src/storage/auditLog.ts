import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface AuditEntry {
  ts: number;
  action: string;
  actor: string;
  subject?: string;
  details?: unknown;
}

let _auditPath: string | null = null;

export function initAuditLog(homeDir: string): void {
  const auditDir = join(homeDir, "audit");
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }
  _auditPath = join(auditDir, "events.jsonl");
}

export function writeAudit(entry: Omit<AuditEntry, "ts">): void {
  if (!_auditPath) return;
  const line = JSON.stringify({ ...entry, ts: Date.now() });
  try {
    appendFileSync(_auditPath, `${line}\n`, "utf-8");
  } catch {
    // Audit failures must not crash the application
  }
}
