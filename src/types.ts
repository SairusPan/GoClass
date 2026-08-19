export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DAY_LABELS: Record<Day, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
}

// Fixed grid of lesson start times
export const TIME_SLOTS: string[] = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00']

export const DURATION_OPTIONS: number[] = [30, 45, 60, 90, 120]

export interface Availability {
  day: Day
  start: string // inclusive, "HH:MM"
  end: string // exclusive, "HH:MM"
}

export interface Teacher {
  id: string
  name: string
  subjects: string[] // Subject ids
  availability: Availability[]
  phone: string
  email: string
}

export interface Subject {
  id: string
  name: string
}

export interface Room {
  id: string
  name: string
  capacity: number
}

export type ClassStatus = 'unscheduled' | 'draft' | 'published'

export interface ClassGroup {
  id: string
  name: string
  subjectId: string
  studentCount: number
  status: ClassStatus
  day: Day | null
  start: string | null // "HH:MM"
  durationMinutes: number
  teacherId: string | null
  roomId: string | null
  date: string | null // concrete calendar date for the current demo week, e.g. "2026-08-17"
}

/** A one-week exception to a class's normal recurring schedule — see ClassGroup. When one exists
 * for a given (classId, weekStartDate), its fields are that week's real schedule, and the
 * class's own template fields are left untouched. */
export interface ClassOverride {
  id: string
  classId: string
  weekStartDate: string
  day: Day
  start: string
  durationMinutes: number
  teacherId: string | null
  roomId: string | null
  status: ClassStatus
}

export interface LeaveRecord {
  id: string
  classId: string
  originalTeacherId: string
  reason: string
  resolution: 'pending' | 'substitute' | 'rescheduled'
  resolvedTeacherId?: string
  resolvedDay?: Day
  resolvedStart?: string
  resolvedDate?: string
  createdAt: string
}

export interface NotificationItem {
  id: string
  audience: 'teacher' | 'student_parent'
  message: string
  createdAt: string
}

export interface Institution {
  id: string
  name: string // institution/business name
  adminName: string
  username: string
  email: string
}

export interface Conflict {
  classId: string
  type: 'teacher' | 'room'
  withClassId: string
  message: string
}
