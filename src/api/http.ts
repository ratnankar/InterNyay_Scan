import { clearToken, getToken, setToken } from '@/auth/token'

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

type Params = Record<string, string | number | boolean | null | undefined>

export function buildUrl(path: string, params?: Params): string {
  if (!API_BASE) throw new ApiError(0, 'The InterNyay server address is not configured.')
  const query = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return `${API_BASE}${path}${query ? `?${query}` : ''}`
}

export async function messageFrom(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.message === 'string' && data.message.length > 0) return data.message
  } catch {
    return fallbackMessage(res.status)
  }
  return fallbackMessage(res.status)
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'That item no longer exists.'
  if (status === 413) return 'The upload is too large.'
  if (status === 429) return 'Too many requests. Please wait a moment.'
  return 'Something went wrong. Please try again.'
}

export async function handleSession(status: number, hadToken: boolean, path: string) {
  if (status === 401 && hadToken && !path.startsWith('/auth/')) {
    await clearToken()
    unauthorizedHandler?.()
  }
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { body?: unknown; params?: Params; signal?: AbortSignal } = {},
): Promise<T> {
  const url = buildUrl(path, options.params)
  const token = await getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let body: string | undefined
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let res: Response
  try {
    res = await fetch(url, { method, headers, body, signal: options.signal })
  } catch {
    throw new ApiError(0, 'Cannot reach InterNyay. Check your internet connection.')
  }

  const renewed = res.headers.get('X-Refreshed-Token')
  if (renewed && token) await setToken(renewed)

  if (!res.ok) {
    await handleSession(res.status, !!token, path)
    throw new ApiError(res.status, await messageFrom(res))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
