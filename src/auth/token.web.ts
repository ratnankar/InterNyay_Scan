const KEY = 'internyay.token'

export async function getToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  window.localStorage.setItem(KEY, token)
}

export async function clearToken(): Promise<void> {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    return
  }
}
