/**
 * Lightweight synchronous JSON-file-backed store.
 * Implements IStore — drop-in replaceable with SqliteStore.
 * Persists atomically by writing a temp file then renaming.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IStore, Row } from "./iStore.js";

interface TableData {
  rows: Row[];
}

export class JsonStore implements IStore {
  private data: Record<string, TableData> = {};
  private dbPath: string;
  private dirty = false;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.load();
  }

  private load(): void {
    if (!existsSync(this.dbPath)) {
      this.data = {};
      return;
    }
    try {
      const raw = readFileSync(this.dbPath, "utf-8");
      this.data = JSON.parse(raw) as Record<string, TableData>;
    } catch {
      this.data = {};
    }
  }

  flush(): void {
    if (!this.dirty) return;
    const tmp = `${this.dbPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), "utf-8");
    renameSync(tmp, this.dbPath);
    this.dirty = false;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 200);
  }

  private table(name: string): Row[] {
    if (!this.data[name]) this.data[name] = { rows: [] };
    return this.data[name].rows;
  }

  insert(tableName: string, row: Row): void {
    this.table(tableName).push(row);
    this.dirty = true;
    this.scheduleFlush();
  }

  upsert(tableName: string, row: Row, pkField: string): void {
    const rows = this.table(tableName);
    const idx = rows.findIndex((r) => r[pkField] === row[pkField]);
    if (idx >= 0) {
      rows[idx] = row;
    } else {
      rows.push(row);
    }
    this.dirty = true;
    this.scheduleFlush();
  }

  upsertByField(tableName: string, row: Row, field: string): void {
    this.upsert(tableName, row, field);
  }

  findAll(tableName: string): Row[] {
    return [...(this.data[tableName]?.rows ?? [])];
  }

  findOne(tableName: string, predicate: (r: Row) => boolean): Row | null {
    return this.data[tableName]?.rows.find(predicate) ?? null;
  }

  find(tableName: string, predicate: (r: Row) => boolean): Row[] {
    return (this.data[tableName]?.rows ?? []).filter(predicate);
  }

  updateWhere(tableName: string, predicate: (r: Row) => boolean, updater: (r: Row) => Row): number {
    const rows = this.table(tableName);
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (predicate(rows[i])) {
        rows[i] = updater(rows[i]);
        count++;
      }
    }
    if (count > 0) {
      this.dirty = true;
      this.scheduleFlush();
    }
    return count;
  }

  deleteWhere(tableName: string, predicate: (r: Row) => boolean): number {
    const tbl = this.data[tableName];
    if (!tbl) return 0;
    const before = tbl.rows.length;
    tbl.rows = tbl.rows.filter((r) => !predicate(r));
    const deleted = before - tbl.rows.length;
    if (deleted > 0) {
      this.dirty = true;
      this.scheduleFlush();
    }
    return deleted;
  }

  count(tableName: string, predicate?: (r: Row) => boolean): number {
    const rows = this.data[tableName]?.rows ?? [];
    return predicate ? rows.filter(predicate).length : rows.length;
  }

  insertUnique(tableName: string, row: Row, pkField: string): boolean {
    const rows = this.table(tableName);
    if (rows.some((r) => r[pkField] === row[pkField])) return false;
    rows.push(row);
    this.dirty = true;
    this.scheduleFlush();
    return true;
  }

  getSchemaVersion(): number {
    const meta = this.data._meta?.rows.find((r) => r.key === "schema_version");
    return meta ? Number(meta.value) : 0;
  }

  setSchemaVersion(v: number): void {
    if (!this.data._meta) this.data._meta = { rows: [] };
    const idx = this.data._meta.rows.findIndex((r) => r.key === "schema_version");
    if (idx >= 0) {
      this.data._meta.rows[idx] = { key: "schema_version", value: v };
    } else {
      this.data._meta.rows.push({ key: "schema_version", value: v });
    }
    this.dirty = true;
    this.scheduleFlush();
  }

  close(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
