// No-op for JsonStore — tables are created on first use.
import type { JsonStore } from "./jsonStore.js";

export function runMigrations(_store: JsonStore): void {
  // JsonStore creates tables dynamically; no DDL needed.
}
