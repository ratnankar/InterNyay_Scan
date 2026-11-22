// Web build: no SQLite. Key/value uses localStorage; the local scan queue is empty/no-op.
const P = 'internyay.kv.'

export async function kvGet(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(P + key)
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(P + key, value)
  } catch {
    return
  }
}

export async function wipeLocalData(): Promise<void> {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(P))
      .forEach((k) => window.localStorage.removeItem(k))
  } catch {
    return
  }
}

type WebDb = {
  runAsync: (...args: unknown[]) => Promise<void>
  execAsync: (...args: unknown[]) => Promise<void>
  getFirstAsync: <T>(...args: unknown[]) => Promise<T | null>
  getAllAsync: <T>(...args: unknown[]) => Promise<T[]>
}

const db: WebDb = {
  runAsync: async () => {},
  execAsync: async () => {},
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
}

export async function getDb(): Promise<any> {
  return db
}
