/**
 * IStore — common interface for all storage backends (JsonStore, future SQLite, etc.)
 * Repos depend on this interface, not on the concrete implementation.
 */
export type Row = Record<string, unknown>;

export interface IStore {
  flush(): void;
  close(): void;
  insert(tableName: string, row: Row): void;
  upsert(tableName: string, row: Row, pkField: string): void;
  upsertByField(tableName: string, row: Row, field: string): void;
  findAll(tableName: string): Row[];
  findOne(tableName: string, predicate: (r: Row) => boolean): Row | null;
  find(tableName: string, predicate: (r: Row) => boolean): Row[];
  updateWhere(tableName: string, predicate: (r: Row) => boolean, updater: (r: Row) => Row): number;
  deleteWhere(tableName: string, predicate: (r: Row) => boolean): number;
  count(tableName: string, predicate?: (r: Row) => boolean): number;
  insertUnique(tableName: string, row: Row, pkField: string): boolean;
  /** Schema versioning */
  getSchemaVersion(): number;
  setSchemaVersion(v: number): void;
}
