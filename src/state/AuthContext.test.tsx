// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { callTo, mockFetch, renderProvider, run } from './testing'

import { storeTokens } from './apiClient'

const INSTITUTION = {
  id: 1,
  name: 'Harbour View Tutoring',
  adminName: 'Alex Nguyen',
  username: 'harbourview',
  email: 'admin@example.com',
}

/** AuthProvider only restores a session when a token is already on disk, so seed one. */
beforeEach(() => {
  localStorage.clear()
  storeTokens('access-token', 'refresh-token')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mount(extraRoutes: Record<string, unknown> = {}) {
  const calls = mockFetch({
    'GET /api/auth/me': { json: INSTITUTION },
    ...extraRoutes,
  } as Parameters<typeof mockFetch>[0])
  const view = await renderProvider(AuthProvider, useAuth)
  return { calls, view }
}

describe('updateProfile', () => {
  it('PATCHes /api/auth/me and pushes the response into currentUser', async () => {
    const { calls, view } = await mount({
      'PATCH /api/auth/me': { json: { ...INSTITUTION, name: 'Renamed Centre', adminName: 'Sairus Pan' } },
    })
    expect(view.current().currentUser?.name).toBe('Harbour View Tutoring')

    await run(() =>
      view.current().updateProfile({ name: 'Renamed Centre', adminName: 'Sairus Pan', email: 'admin@example.com' }),
    )

    const call = callTo(calls, 'PATCH', '/api/auth/me')
    expect(call.body).toEqual({ name: 'Renamed Centre', adminName: 'Sairus Pan', email: 'admin@example.com' })
    expect(view.current().currentUser).toMatchObject({ name: 'Renamed Centre', adminName: 'Sairus Pan' })
  })

  it('never sends username or password, even though they live on the same record', async () => {
    const { calls, view } = await mount({ 'PATCH /api/auth/me': { json: INSTITUTION } })

    await run(() =>
      view.current().updateProfile({ name: 'X', adminName: 'Y', email: 'z@example.com' }),
    )

    const body = callTo(calls, 'PATCH', '/api/auth/me').body as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['adminName', 'email', 'name'])
  })

  it('returns the backend message instead of throwing, so the page can render it inline', async () => {
    const { view } = await mount({
      'PATCH /api/auth/me': { status: 400, json: { error: 'You need an email to receive password resets.' } },
    })

    let result: { ok: boolean; error?: string } | undefined
    await run(async () => {
      result = await view.current().updateProfile({ name: 'X', adminName: 'Y', email: '' })
    })

    expect(result).toEqual({ ok: false, error: 'You need an email to receive password resets.' })
    // a rejected save must not clobber the user we already had on screen
    expect(view.current().currentUser?.name).toBe('Harbour View Tutoring')
  })

  it('reports a readable error when the backend is unreachable', async () => {
    const { view } = await mount()
    // the session restored fine; only the save that follows hits a dead backend
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })

    let result: { ok: boolean; error?: string } | undefined
    await run(async () => {
      result = await view.current().updateProfile({ name: 'X', adminName: 'Y', email: 'z@example.com' })
    })

    expect(result?.ok).toBe(false)
    expect(result?.error).toContain('Could not reach the server')
  })
})
