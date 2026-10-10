/** One record as the backends serve it: a JSON object keyed by field name. */
export type Row = Record<string, unknown>;

interface Entry {
  row: Row;
  versions: Row[];
  deleted: boolean;
}

/**
 * The in-memory state behind `handlersFromModel`. Records are keyed by schema name and id;
 * a delete tombstones the record (a `get` is 404, the history survives) as the backends do.
 */
export interface Store {
  /** Adds rows as version 1 records; a row without an id gets one. */
  seed(schema: string, rows: readonly Row[]): Row[];
  /** Live (non-deleted) rows in insertion order. */
  list(schema: string): Row[];
  /** The live row, or `undefined` when missing or tombstoned. */
  get(schema: string, id: string): Row | undefined;
  insert(schema: string, id: string, row: Row): Row;
  /** Replaces the live row and records the previous version. */
  replace(schema: string, id: string, row: Row): Row;
  /** Tombstones the record; `false` when it is missing or already deleted. */
  remove(schema: string, id: string): boolean;
  /** Every version of the record, oldest first, or `undefined` when it never existed. */
  history(schema: string, id: string): Row[] | undefined;
  /** Drops everything (and re-applies the construction seed when given). */
  reset(): void;
}

export const ID_FIELDS = ['entity_id', 'id'] as const;

/** The id of a row by the backends' convention: `entity_id`, else `id`. */
export function idOf(row: Row, idField?: string): string | undefined {
  const candidates = idField === undefined ? ID_FIELDS : [idField, ...ID_FIELDS];
  for (const field of candidates) {
    const value = row[field];
    if (typeof value === 'string' && value !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

export function createStore(seed?: Readonly<Record<string, readonly Row[]>>): Store {
  const tables = new Map<string, Map<string, Entry>>();
  const table = (schema: string): Map<string, Entry> => {
    let entries = tables.get(schema);
    if (entries === undefined) {
      entries = new Map();
      tables.set(schema, entries);
    }
    return entries;
  };
  const store: Store = {
    seed(schema, rows) {
      return rows.map((row) => {
        const id = idOf(row) ?? crypto.randomUUID();
        const stored: Row = { ...row };
        if (idOf(row) === undefined) stored.entity_id = id;
        stored.record_version ??= 1;
        return store.insert(schema, id, stored);
      });
    },
    list(schema) {
      return [...table(schema).values()].filter((e) => !e.deleted).map((e) => e.row);
    },
    get(schema, id) {
      const entry = table(schema).get(id);
      return entry === undefined || entry.deleted ? undefined : entry.row;
    },
    insert(schema, id, row) {
      table(schema).set(id, { row, versions: [row], deleted: false });
      return row;
    },
    replace(schema, id, row) {
      const entry = table(schema).get(id);
      if (entry === undefined) return store.insert(schema, id, row);
      entry.row = row;
      entry.versions.push(row);
      entry.deleted = false;
      return row;
    },
    remove(schema, id) {
      const entry = table(schema).get(id);
      if (entry === undefined || entry.deleted) return false;
      entry.deleted = true;
      return true;
    },
    history(schema, id) {
      const entry = table(schema).get(id);
      return entry === undefined ? undefined : [...entry.versions];
    },
    reset() {
      tables.clear();
      if (seed !== undefined)
        for (const [schema, rows] of Object.entries(seed)) store.seed(schema, rows);
    },
  };
  store.reset();
  return store;
}
