import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'
import { expect, vi } from 'vitest'

/** One recorded fetch call, flattened into the bits assertions actually care about. */
export interface RecordedCall {
  url: string
  method: string
  body: unknown
  contentType: string | null
}

type Reply = { status?: number; json?: unknown }

/**
 * Replaces global.fetch with a queue-free router: each entry matches on "METHOD /path" and
 * returns canned JSON. Anything unmatched fails loudly rather than resolving to undefined,
 * because a silently-wrong URL is exactly the bug these tests exist to catch.
 */
export function mockFetch(routes: Record<string, Reply | ((body: unknown) => Reply)>) {
  const calls: RecordedCall[] = []

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const method = (init.method ?? 'GET').toUpperCase()
    const body = parseRequestBody(init.body)
    const contentType = new Headers(init.headers).get('Content-Type')
    calls.push({ url, method, body, contentType })

    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const route = routes[`${method} ${path}`]
    if (!route) {
      throw new Error(`Unexpected request: ${method} ${path}\nKnown routes: ${Object.keys(routes).join(', ')}`)
    }

    const { status = 200, json = null } = typeof route === 'function' ? route(body) : route
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    } as Response
  })

  return calls
}

function parseRequestBody(raw: BodyInit | null | undefined): unknown {
  if (raw == null || raw === '') return undefined
  if (typeof FormData !== 'undefined' && raw instanceof FormData) {
    const entries: Record<string, unknown> = {}
    raw.forEach((value, key) => {
      entries[key] = value
    })
    return entries
  }
  return JSON.parse(String(raw))
}

/** The single call made to `path`, asserted to exist so tests fail on the URL, not on undefined. */
export function callTo(calls: RecordedCall[], method: string, path: string): RecordedCall {
  const match = calls.find((c) => c.method === method && c.url.endsWith(path))
  expect(match, `no ${method} to ${path}; saw ${calls.map((c) => `${c.method} ${c.url}`).join(', ')}`).toBeDefined()
  return match as RecordedCall
}

/**
 * Mounts a provider and hands back a live getter for whatever its hook exposes. React 19 ships
 * `act` itself, so this stays free of @testing-library — the only thing needed on top of vitest
 * is a DOM, which the `@vitest-environment jsdom` docblock in each test file provides.
 */
export async function renderProvider<T>(
  Provider: (props: { children: ReactNode }) => ReactNode,
  useHook: () => T,
): Promise<{ current: () => T; unmount: () => void }> {
  let latest: T
  function Probe() {
    latest = useHook()
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<Provider>{<Probe />}</Provider>)
  })

  return {
    current: () => latest,
    unmount: () => act(() => root.unmount()),
  }
}

/** Runs a context method inside act() so the state update it triggers is flushed before asserting. */
export async function run(action: () => Promise<unknown>) {
  await act(async () => {
    await action()
  })
}
