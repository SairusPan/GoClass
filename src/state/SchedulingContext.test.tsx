// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SchedulingProvider, useScheduling } from './SchedulingContext'
import { callTo, mockFetch, renderProvider, run } from './testing'

const SUBJECT = { id: 7, name: 'Biology' }
const TEACHER = { id: 3, name: 'Sarah Chen', phone: '', email: '', subjectIds: [7], availability: [] }
const ROOM = { id: 5, name: 'Room A', capacity: 20 }
const CLASS = {
  id: 11,
  name: 'Biology U1/2',
  subjectId: 7,
  studentCount: 6,
  status: 'published',
  day: 'Mon',
  start: '16:00',
  durationMinutes: 60,
  teacherId: 3,
  roomId: 5,
  date: '2026-09-14',
}
const LEAVE = {
  id: 21,
  classId: 11,
  originalTeacherId: 3,
  reason: 'Sik leave',
  resolution: 'pending',
  resolvedTeacherId: null,
  resolvedDay: null,
  resolvedStart: null,
  resolvedDate: null,
  createdAt: '2026-09-14T00:00:00Z',
}
const NOTE = { id: 31, audience: 'teacher', message: 'Finding cover…', read: false, createdAt: '2026-09-14T00:00:00Z' }

/** The six GETs SchedulingProvider fires on mount; every test needs them before anything else. */
function initialLoad() {
  return {
    'GET /api/teachers': { json: [TEACHER] },
    'GET /api/subjects': { json: [SUBJECT] },
    'GET /api/rooms': { json: [ROOM] },
    'GET /api/classes': { json: [CLASS] },
    'GET /api/leave': { json: [LEAVE] },
    'GET /api/notifications': { json: [NOTE] },
  }
}

async function mount(extraRoutes: Record<string, unknown> = {}) {
  const calls = mockFetch({ ...initialLoad(), ...extraRoutes } as Parameters<typeof mockFetch>[0])
  const view = await renderProvider(SchedulingProvider, useScheduling)
  return { calls, view }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('updateClass', () => {
  it('patches /details rather than the scheduling route, and sends subjectId as a number', async () => {
    const { calls, view } = await mount({
      'PATCH /api/classes/11/details': { json: { ...CLASS, name: 'Renamed', subjectId: 7, studentCount: 19 } },
    })

    await run(() =>
      view.current().updateClass('11', { name: 'Renamed', subjectId: '7', studentCount: 19, durationMinutes: 90 }),
    )

    const call = callTo(calls, 'PATCH', '/api/classes/11/details')
    // the plain PATCH /api/classes/11 would auto-promote an unscheduled class to draft
    expect(calls.some((c) => c.url.endsWith('/api/classes/11'))).toBe(false)
    expect(call.body).toEqual({ name: 'Renamed', subjectId: 7, studentCount: 19, durationMinutes: 90 })
  })

  it('replaces only the edited class in state', async () => {
    const { view } = await mount({
      'PATCH /api/classes/11/details': { json: { ...CLASS, name: 'Renamed', studentCount: 19 } },
    })

    await run(() =>
      view.current().updateClass('11', { name: 'Renamed', subjectId: '7', studentCount: 19, durationMinutes: 60 }),
    )

    expect(view.current().classes).toHaveLength(1)
    expect(view.current().classes[0]).toMatchObject({ id: '11', name: 'Renamed', studentCount: 19 })
  })

  it('surfaces the backend message so the UI can show it instead of failing silently', async () => {
    const { view } = await mount({
      'PATCH /api/classes/11/details': { status: 404, json: { error: 'Subject not found.' } },
    })

    await expect(
      view.current().updateClass('11', { name: 'x', subjectId: '99', studentCount: 1, durationMinutes: 60 }),
    ).rejects.toThrow('Subject not found.')
  })
})

describe('leave records', () => {
  it('updateLeaveReason patches just the reason and swaps the record in state', async () => {
    const { calls, view } = await mount({
      'PATCH /api/leave/21': { json: { ...LEAVE, reason: 'Sick leave' } },
    })

    await run(() => view.current().updateLeaveReason('21', 'Sick leave'))

    expect(callTo(calls, 'PATCH', '/api/leave/21').body).toEqual({ reason: 'Sick leave' })
    expect(view.current().leaveRecords[0].reason).toBe('Sick leave')
  })

  it('cancelLeave marks the record cancelled and reloads classes, because the timetable moved back', async () => {
    const restored = { ...CLASS, day: 'Mon', start: '16:00', teacherId: 3, roomId: 5 }
    const { calls, view } = await mount({
      'POST /api/leave/21/cancel': { json: { ...LEAVE, resolution: 'cancelled' } },
      'GET /api/classes': { json: [restored] },
    })
    const classGetsBefore = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/classes')).length

    await run(() => view.current().cancelLeave('21'))

    expect(view.current().leaveRecords[0].resolution).toBe('cancelled')
    const classGetsAfter = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/classes')).length
    expect(classGetsAfter).toBe(classGetsBefore + 1)
  })
})

describe('notifications', () => {
  it('markNotificationRead flips just that row', async () => {
    const { calls, view } = await mount({
      'PATCH /api/notifications/31/read': { json: { ...NOTE, read: true } },
    })
    expect(view.current().notifications[0].read).toBe(false)

    await run(() => view.current().markNotificationRead('31'))

    callTo(calls, 'PATCH', '/api/notifications/31/read')
    expect(view.current().notifications[0].read).toBe(true)
  })

  it('markAllNotificationsRead replaces the list with the server response', async () => {
    const { view } = await mount({
      'POST /api/notifications/read-all': { json: [{ ...NOTE, read: true }] },
    })

    await run(() => view.current().markAllNotificationsRead())

    expect(view.current().notifications.every((n) => n.read)).toBe(true)
  })

  it('deleteNotification drops one row, clearNotifications empties the list', async () => {
    const { view } = await mount({
      'DELETE /api/notifications/31': { status: 204 },
      'DELETE /api/notifications': { status: 204 },
    })

    await run(() => view.current().deleteNotification('31'))
    expect(view.current().notifications).toHaveLength(0)

    await run(() => view.current().clearNotifications())
    expect(view.current().notifications).toHaveLength(0)
  })

  it('a failed delete throws and leaves the list untouched', async () => {
    const { view } = await mount({
      'DELETE /api/notifications/31': { status: 404, json: { error: 'Notification not found.' } },
    })

    await expect(view.current().deleteNotification('31')).rejects.toThrow('Notification not found.')
    expect(view.current().notifications).toHaveLength(1)
  })
})

describe('importCsv', () => {
  it('posts FormData to /api/import/{type} without a JSON content-type, then reloads setup lists', async () => {
    const imported = { id: 8, name: 'Chemistry' }
    let saved = false
    const { calls, view } = await mount({
      'POST /api/import/subjects': () => {
        saved = true
        return { json: { type: 'subjects', imported: 1 } }
      },
      'GET /api/subjects': () => ({ json: saved ? [SUBJECT, imported] : [SUBJECT] }),
    })
    expect(view.current().subjects.map((s) => s.name)).toEqual(['Biology'])
    const subjectGetsBefore = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/subjects')).length

    const file = new File(['name\nChemistry\n'], 'subjects.csv', { type: 'text/csv' })
    let result: { imported: number } | undefined
    await run(async () => {
      result = await view.current().importCsv('subjects', file)
    })

    const call = callTo(calls, 'POST', '/api/import/subjects')
    expect(call.contentType).toBeNull()
    expect(call.body).toEqual({ file: expect.any(File) })
    expect(result).toEqual({ imported: 1 })
    expect(view.current().subjects.map((s) => s.name)).toEqual(['Biology', 'Chemistry'])
    const subjectGetsAfter = calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/subjects')).length
    expect(subjectGetsAfter).toBe(subjectGetsBefore + 1)
  })

  it('surfaces the backend message and leaves setup lists untouched', async () => {
    const { view } = await mount({
      'POST /api/import/subjects': { status: 400, json: { error: 'Row 2: subject "Biology" already exists.' } },
    })

    const file = new File(['name\nBiology\n'], 'subjects.csv', { type: 'text/csv' })
    await expect(run(() => view.current().importCsv('subjects', file))).rejects.toThrow('already exists')
    expect(view.current().subjects).toHaveLength(1)
    expect(view.current().subjects[0].name).toBe('Biology')
  })
})
