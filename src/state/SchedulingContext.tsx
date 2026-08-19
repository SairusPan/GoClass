import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Availability, ClassGroup, Day, LeaveRecord, NotificationItem, Room, Subject, Teacher } from '../types'
import { findConflicts } from '../utils/scheduling'
import { apiFetch, apiFetchJson, readError } from './apiClient'

interface SchedulingState {
  classes: ClassGroup[]
  teachers: Teacher[]
  subjects: Subject[]
  rooms: Room[]
  leaveRecords: LeaveRecord[]
  notifications: NotificationItem[]
  conflicts: ReturnType<typeof findConflicts>
  isLoading: boolean

  assignClass: (classId: string, patch: Partial<Pick<ClassGroup, 'teacherId' | 'roomId' | 'day' | 'start' | 'durationMinutes' | 'status'>>) => Promise<void>
  publishClass: (classId: string) => Promise<void>
  publishAllDrafts: () => Promise<void>
  fileLeave: (classId: string, reason: string) => Promise<string>
  resolveWithSubstitute: (leaveId: string, teacherId: string) => Promise<void>
  resolveWithReschedule: (leaveId: string, day: Day, start: string, roomId: string) => Promise<void>
  addTeacher: (t: { name: string; phone: string; email: string; subjects: string[]; availability: Availability[] }) => Promise<void>
  addSubject: (name: string) => Promise<void>
  addRoom: (name: string, capacity: number) => Promise<void>
  addClass: (c: { name: string; subjectId: string; studentCount: number; durationMinutes: number }) => Promise<void>
  deleteClass: (classId: string) => Promise<void>
}

const SchedulingContext = createContext<SchedulingState | null>(null)

// --- backend <-> frontend shape mapping -------------------------------------------------
// Backend ids are numbers; the rest of the app (and its 23 scheduling.ts unit tests) treats
// ids as opaque strings, so every id gets stringified on the way in and Number()'d on the way out.

interface BackendTeacher {
  id: number
  name: string
  phone: string | null
  email: string | null
  subjectIds: number[]
  availability: Availability[]
}
interface BackendSubject {
  id: number
  name: string
}
interface BackendRoom {
  id: number
  name: string
  capacity: number
}
interface BackendClass {
  id: number
  name: string
  subjectId: number
  studentCount: number
  status: ClassGroup['status']
  day: Day | null
  start: string | null
  durationMinutes: number
  teacherId: number | null
  roomId: number | null
  date: string | null
}
interface BackendLeave {
  id: number
  classId: number
  originalTeacherId: number
  reason: string
  resolution: LeaveRecord['resolution']
  resolvedTeacherId: number | null
  resolvedDay: Day | null
  resolvedStart: string | null
  resolvedDate: string | null
  createdAt: string
}
interface BackendNotification {
  id: number
  audience: NotificationItem['audience']
  message: string
  createdAt: string
}

function mapTeacher(t: BackendTeacher): Teacher {
  return {
    id: String(t.id),
    name: t.name,
    phone: t.phone ?? '',
    email: t.email ?? '',
    subjects: t.subjectIds.map(String),
    availability: t.availability,
  }
}
function mapSubject(s: BackendSubject): Subject {
  return { id: String(s.id), name: s.name }
}
function mapRoom(r: BackendRoom): Room {
  return { id: String(r.id), name: r.name, capacity: r.capacity }
}
function mapClass(c: BackendClass): ClassGroup {
  return {
    id: String(c.id),
    name: c.name,
    subjectId: String(c.subjectId),
    studentCount: c.studentCount,
    status: c.status,
    day: c.day,
    start: c.start,
    durationMinutes: c.durationMinutes,
    teacherId: c.teacherId == null ? null : String(c.teacherId),
    roomId: c.roomId == null ? null : String(c.roomId),
    date: c.date,
  }
}
function mapLeave(r: BackendLeave): LeaveRecord {
  return {
    id: String(r.id),
    classId: String(r.classId),
    originalTeacherId: String(r.originalTeacherId),
    reason: r.reason,
    resolution: r.resolution,
    resolvedTeacherId: r.resolvedTeacherId == null ? undefined : String(r.resolvedTeacherId),
    resolvedDay: r.resolvedDay ?? undefined,
    resolvedStart: r.resolvedStart ?? undefined,
    resolvedDate: r.resolvedDate ?? undefined,
    createdAt: r.createdAt,
  }
}
function mapNotification(n: BackendNotification): NotificationItem {
  return { id: String(n.id), audience: n.audience, message: n.message, createdAt: n.createdAt }
}

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<ClassGroup[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const conflicts = useMemo(() => findConflicts(classes), [classes])

  useEffect(() => {
    async function loadAll() {
      try {
        const [t, s, r, c, l, n] = await Promise.all([
          apiFetchJson<BackendTeacher[]>('/api/teachers'),
          apiFetchJson<BackendSubject[]>('/api/subjects'),
          apiFetchJson<BackendRoom[]>('/api/rooms'),
          apiFetchJson<BackendClass[]>('/api/classes'),
          apiFetchJson<BackendLeave[]>('/api/leave'),
          apiFetchJson<BackendNotification[]>('/api/notifications'),
        ])
        setTeachers(t.map(mapTeacher))
        setSubjects(s.map(mapSubject))
        setRooms(r.map(mapRoom))
        setClasses(c.map(mapClass))
        setLeaveRecords(l.map(mapLeave))
        setNotifications(n.map(mapNotification))
      } finally {
        setIsLoading(false)
      }
    }
    loadAll()
  }, [])

  async function refreshClasses() {
    const list = await apiFetchJson<BackendClass[]>('/api/classes')
    setClasses(list.map(mapClass))
  }

  async function refreshNotifications() {
    const list = await apiFetchJson<BackendNotification[]>('/api/notifications')
    setNotifications(list.map(mapNotification))
  }

  async function assignClass(
    classId: string,
    patch: Partial<Pick<ClassGroup, 'teacherId' | 'roomId' | 'day' | 'start' | 'durationMinutes' | 'status'>>,
  ) {
    const body: Record<string, unknown> = {}
    if ('teacherId' in patch) body.teacherId = patch.teacherId == null ? null : Number(patch.teacherId)
    if ('roomId' in patch) body.roomId = patch.roomId == null ? null : Number(patch.roomId)
    if ('day' in patch) body.day = patch.day
    if ('start' in patch) body.start = patch.start
    if ('durationMinutes' in patch) body.durationMinutes = patch.durationMinutes
    if ('status' in patch) body.status = patch.status

    const updated = await apiFetchJson<BackendClass>(`/api/classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    setClasses((prev) => prev.map((c) => (c.id === classId ? mapClass(updated) : c)))
  }

  async function publishClass(classId: string) {
    const updated = await apiFetchJson<BackendClass>(`/api/classes/${classId}/publish`, { method: 'POST' })
    setClasses((prev) => prev.map((c) => (c.id === classId ? mapClass(updated) : c)))
  }

  async function publishAllDrafts() {
    const updated = await apiFetchJson<BackendClass[]>('/api/classes/publish-drafts', { method: 'POST' })
    setClasses(updated.map(mapClass))
  }

  async function fileLeave(classId: string, reason: string): Promise<string> {
    const created = await apiFetchJson<BackendLeave>('/api/leave', {
      method: 'POST',
      body: JSON.stringify({ classId: Number(classId), reason }),
    })
    const mapped = mapLeave(created)
    setLeaveRecords((prev) => [mapped, ...prev])
    await refreshNotifications()
    return mapped.id
  }

  async function resolveWithSubstitute(leaveId: string, teacherId: string) {
    const updated = await apiFetchJson<BackendLeave>(`/api/leave/${leaveId}/substitute`, {
      method: 'POST',
      body: JSON.stringify({ teacherId: Number(teacherId) }),
    })
    setLeaveRecords((prev) => prev.map((r) => (r.id === leaveId ? mapLeave(updated) : r)))
    await Promise.all([refreshClasses(), refreshNotifications()])
  }

  async function resolveWithReschedule(leaveId: string, day: Day, start: string, roomId: string) {
    const updated = await apiFetchJson<BackendLeave>(`/api/leave/${leaveId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ day, start, roomId: Number(roomId) }),
    })
    setLeaveRecords((prev) => prev.map((r) => (r.id === leaveId ? mapLeave(updated) : r)))
    await Promise.all([refreshClasses(), refreshNotifications()])
  }

  async function addTeacher(t: { name: string; phone: string; email: string; subjects: string[]; availability: Availability[] }) {
    const created = await apiFetchJson<BackendTeacher>('/api/teachers', {
      method: 'POST',
      body: JSON.stringify({
        name: t.name,
        phone: t.phone,
        email: t.email || null,
        subjectIds: t.subjects.map(Number),
        availability: t.availability,
      }),
    })
    setTeachers((prev) => [...prev, mapTeacher(created)])
  }

  async function addSubject(name: string) {
    const created = await apiFetchJson<BackendSubject>('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) })
    setSubjects((prev) => [...prev, mapSubject(created)])
  }

  async function addRoom(name: string, capacity: number) {
    const created = await apiFetchJson<BackendRoom>('/api/rooms', { method: 'POST', body: JSON.stringify({ name, capacity }) })
    setRooms((prev) => [...prev, mapRoom(created)])
  }

  async function addClass(c: { name: string; subjectId: string; studentCount: number; durationMinutes: number }) {
    const created = await apiFetchJson<BackendClass>('/api/classes', {
      method: 'POST',
      body: JSON.stringify({
        name: c.name,
        subjectId: Number(c.subjectId),
        studentCount: c.studentCount,
        durationMinutes: c.durationMinutes,
      }),
    })
    setClasses((prev) => [...prev, mapClass(created)])
  }

  async function deleteClass(classId: string) {
    const res = await apiFetch(`/api/classes/${classId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await readError(res, 'Could not delete this class.'))
    setClasses((prev) => prev.filter((c) => c.id !== classId))
  }

  const value: SchedulingState = {
    classes,
    teachers,
    subjects,
    rooms,
    leaveRecords,
    notifications,
    conflicts,
    isLoading,
    assignClass,
    publishClass,
    publishAllDrafts,
    fileLeave,
    resolveWithSubstitute,
    resolveWithReschedule,
    addTeacher,
    addSubject,
    addRoom,
    addClass,
    deleteClass,
  }

  return <SchedulingContext.Provider value={value}>{children}</SchedulingContext.Provider>
}

export function useScheduling() {
  const ctx = useContext(SchedulingContext)
  if (!ctx) throw new Error('useScheduling must be used within SchedulingProvider')
  return ctx
}
