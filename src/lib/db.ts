// Force the non-browser entry — it cleanly exports `default` for ESM interop.
// The "browser" condition in sql.js points to a UMD file that breaks Vite ESM resolution.
// @ts-ignore — explicit dist path avoids the "browser" export condition mismatch.
import initSqlJs from "sql.js/dist/sql-wasm.js";
import type { Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA, SEED_SQL } from "./seed";

const STORAGE_KEY = "rcm_prototype_db_v10";

// Wipe any older version keys on module init — keeps localStorage clean and
// guarantees a stale prior version can never resurrect after a schema change.
try {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("rcm_prototype_db_") && k !== STORAGE_KEY) {
      localStorage.removeItem(k);
    }
  }
} catch { /* ignore (SSR / privacy mode) */ }

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: () => wasmUrl });
      const stored = localStorage.getItem(STORAGE_KEY);
      let db: Database;
      if (stored) {
        try {
          const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
          db = new SQL.Database(bytes);
        } catch {
          db = new SQL.Database();
          db.run(SCHEMA);
          db.run(SEED_SQL);
          persist(db);
        }
      } else {
        db = new SQL.Database();
        db.run(SCHEMA);
        db.run(SEED_SQL);
        persist(db);
      }
      return db;
    })();
  }
  return dbPromise;
}

export function persist(db: Database) {
  const bytes = db.export();
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  localStorage.setItem(STORAGE_KEY, btoa(binary));
}

export async function resetDb() {
  localStorage.removeItem(STORAGE_KEY);
  dbPromise = null;
  return getDb();
}

export type Row = Record<string, string | number | null>;

export async function query<T = Row>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as never);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function queryOne<T = Row>(sql: string, params: (string | number | null)[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// Write helper — INSERT/UPDATE/DELETE with parameter binding, then persist to localStorage.
export async function exec(sql: string, params: (string | number | null)[] = []): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as never);
  while (stmt.step()) { /* drain */ }
  stmt.free();
  persist(db);
}
