// In production this app is served by the same Spring Boot process it talks to (see the
// Dockerfile), so API calls are same-origin — default to a relative "" base then. In dev, the
// frontend runs on its own Vite server (5173) while the backend runs separately on 8080, so
// default to that instead. VITE_API_BASE_URL always overrides both when explicitly set.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

const ACCESS_TOKEN_KEY = 'tt_access_token'
const REFRESH_TOKEN_KEY = 'tt_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return typeof body.error === 'string' ? body.error : fallback
  } catch {
    return fallback
  }
}

/** Refresh-token rotation on the client side: the backend invalidates the refresh token used
 * here and hands back a brand new pair, so we always overwrite both, never just the access token. */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      clearTokens()
      return false
    }
    const body = await res.json()
    storeTokens(body.accessToken, body.refreshToken)
    return true
  } catch {
    return false
  }
}

/** Attaches the access token and, on a 401, refreshes once and retries the same call before giving up. */
export async function apiFetch(path: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
  const accessToken = getAccessToken()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && allowRetry && getRefreshToken()) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiFetch(path, options, false)
  }

  return res
}

/** apiFetch + JSON-decode + throw a readable Error on failure, for callers that just want data. */
export async function apiFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    throw new Error(await readError(res, `Request to ${path} failed (${res.status}).`))
  }
  return res.json() as Promise<T>
}
