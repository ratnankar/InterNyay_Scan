import * as SQLite from 'expo-sqlite'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('internyay-scan.db')
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS scans (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          client_id INTEGER,
          client_name TEXT,
          case_id INTEGER,
          case_title TEXT,
          page_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          ocr_status TEXT NOT NULL,
          error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          server_id TEXT
        );
      `)
      return db
    })()
  }
  return dbPromise
}

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)
  return row?.value ?? null
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value)
}

export async function wipeLocalData(): Promise<void> {
  const db = await getDb()
  await db.execAsync('DELETE FROM scans; DELETE FROM kv;')
}
