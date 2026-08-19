import { DAYS, TIME_SLOTS, type ClassGroup, type Conflict, type Day, type Room, type Teacher } from '../types'
import { getWeekDates } from '../data/mockData'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Adds `minutes` to a "HH:MM" clock time, e.g. addMinutesToTime('16:00', 90) -> '17:30'. */
export function addMinutesToTime(hhmm: string, minutes: number): string {
  const total = toMinutes(hhmm) + minutes
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timesOverlap(aStart: string, aDuration: number, bStart: string, bDuration: number): boolean {
  const aFrom = toMinutes(aStart)
  const aTo = aFrom + aDuration
  const bFrom = toMinutes(bStart)
  const bTo = bFrom + bDuration
  return aFrom < bTo && bFrom < aTo
}

function slotWithinAvailability(day: Day, start: string, durationMinutes: number, teacher: Teacher): boolean {
  const end = addMinutesToTime(start, durationMinutes)
  return teacher.availability.some((a) => a.day === day && start >= a.start && end <= a.end)
}

/** Scans every scheduled/draft/published class and flags teacher or room double-bookings. */
export function findConflicts(classes: ClassGroup[]): Conflict[] {
  const conflicts: Conflict[] = []
  const active = classes.filter((c) => c.status !== 'unscheduled' && c.day && c.start)

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.day !== b.day) continue
      if (!timesOverlap(a.start as string, a.durationMinutes, b.start as string, b.durationMinutes)) continue

      if (a.teacherId && a.teacherId === b.teacherId) {
        conflicts.push({
          classId: a.id,
          withClassId: b.id,
          type: 'teacher',
          message: `Same teacher is booked for "${a.name}" and "${b.name}" at the same time`,
        })
      }
      if (a.roomId && a.roomId === b.roomId) {
        conflicts.push({
          classId: a.id,
          withClassId: b.id,
          type: 'room',
          message: `Room is double-booked between "${a.name}" and "${b.name}"`,
        })
      }
    }
  }
  return conflicts
}

export interface Suggestion {
  teacherId: string
  roomId: string
  day: Day
  start: string
  score: number
  reason: string
}

interface Booking {
  day: Day
  start: string
  durationMinutes: number
}

function isFree(bookings: Booking[] | undefined, day: Day, start: string, durationMinutes: number): boolean {
  if (!bookings) return true
  return !bookings.some((b) => b.day === day && timesOverlap(b.start, b.durationMinutes, start, durationMinutes))
}

/**
 * Greedy candidate generator: for one unscheduled class, find (teacher, room, day, start)
 * combinations that satisfy the hard constraints (subject match, teacher availability,
 * no teacher/room clash with anything already scheduled). Not an optimiser — first-fit,
 * ranked by a simple heuristic so the admin still has to pick and confirm.
 */
export function generateSuggestions(
  target: ClassGroup,
  allClasses: ClassGroup[],
  teachers: Teacher[],
  rooms: Room[],
  limit = 3,
): Suggestion[] {
  const eligibleTeachers = teachers.filter((t) => t.subjects.includes(target.subjectId))
  const bookingsByTeacher = new Map<string, Booking[]>()
  const bookingsByRoom = new Map<string, Booking[]>()

  allClasses
    .filter((c) => c.status !== 'unscheduled' && c.id !== target.id && c.day && c.start)
    .forEach((c) => {
      const booking: Booking = { day: c.day as Day, start: c.start as string, durationMinutes: c.durationMinutes }
      if (c.teacherId) {
        if (!bookingsByTeacher.has(c.teacherId)) bookingsByTeacher.set(c.teacherId, [])
        bookingsByTeacher.get(c.teacherId)!.push(booking)
      }
      if (c.roomId) {
        if (!bookingsByRoom.has(c.roomId)) bookingsByRoom.set(c.roomId, [])
        bookingsByRoom.get(c.roomId)!.push(booking)
      }
    })

  const suitableRooms = rooms.filter((r) => r.capacity >= target.studentCount)
  const candidates: Suggestion[] = []

  for (const teacher of eligibleTeachers) {
    for (const day of DAYS) {
      for (const start of TIME_SLOTS) {
        if (!slotWithinAvailability(day, start, target.durationMinutes, teacher)) continue
        if (!isFree(bookingsByTeacher.get(teacher.id), day, start, target.durationMinutes)) continue

        for (const room of suitableRooms) {
          if (!isFree(bookingsByRoom.get(room.id), day, start, target.durationMinutes)) continue

          let score = 1
          let reason = 'Teacher available and qualified for this subject'
          if (room.capacity - target.studentCount <= 2) {
            score += 1
            reason += '; room size closely matches class size'
          }
          candidates.push({ teacherId: teacher.id, roomId: room.id, day, start, score, reason })
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, limit)
}

export interface SubstituteCandidate {
  teacherId: string
  score: number
  reason: string
}

/** Finds teachers who could cover a specific session while the assigned teacher is away. */
export function findSubstitutes(
  session: ClassGroup,
  allClasses: ClassGroup[],
  teachers: Teacher[],
): SubstituteCandidate[] {
  if (!session.day || !session.start) return []

  const busyTeacherIds = new Set(
    allClasses
      .filter(
        (c) =>
          c.id !== session.id &&
          c.status !== 'unscheduled' &&
          c.day === session.day &&
          c.start &&
          timesOverlap(c.start, c.durationMinutes, session.start as string, session.durationMinutes),
      )
      .map((c) => c.teacherId)
      .filter(Boolean) as string[],
  )

  return teachers
    .filter((t) => t.id !== session.teacherId)
    .filter((t) => t.subjects.includes(session.subjectId))
    .filter((t) => slotWithinAvailability(session.day as Day, session.start as string, session.durationMinutes, t))
    .filter((t) => !busyTeacherIds.has(t.id))
    .map((t) => ({
      teacherId: t.id,
      score: t.subjects[0] === session.subjectId ? 2 : 1,
      reason: 'Teaches this subject and is free at this time',
    }))
    .sort((a, b) => b.score - a.score)
}

export interface RescheduleOption {
  day: Day
  start: string
  date: string
  roomId: string
  score: number
}

/** When no substitute exists, find other slots (still within the original teacher's own
 * availability) where the class could be moved instead. */
export function findRescheduleOptions(
  session: ClassGroup,
  allClasses: ClassGroup[],
  teacher: Teacher,
  rooms: Room[],
  limit = 3,
): RescheduleOption[] {
  const teacherBookings: Booking[] = allClasses
    .filter((c) => c.id !== session.id && c.status !== 'unscheduled' && c.teacherId === teacher.id && c.day && c.start)
    .map((c) => ({ day: c.day as Day, start: c.start as string, durationMinutes: c.durationMinutes }))

  const bookingsByRoom = new Map<string, Booking[]>()
  allClasses
    .filter((c) => c.id !== session.id && c.status !== 'unscheduled' && c.roomId && c.day && c.start)
    .forEach((c) => {
      const booking: Booking = { day: c.day as Day, start: c.start as string, durationMinutes: c.durationMinutes }
      if (!bookingsByRoom.has(c.roomId as string)) bookingsByRoom.set(c.roomId as string, [])
      bookingsByRoom.get(c.roomId as string)!.push(booking)
    })

  const suitableRooms = rooms.filter((r) => r.capacity >= session.studentCount)
  const weekDates = getWeekDates()
  const options: RescheduleOption[] = []

  for (const day of DAYS) {
    for (const start of TIME_SLOTS) {
      if (day === session.day && start === session.start) continue
      if (!slotWithinAvailability(day, start, session.durationMinutes, teacher)) continue
      if (!isFree(teacherBookings, day, start, session.durationMinutes)) continue

      for (const room of suitableRooms) {
        if (!isFree(bookingsByRoom.get(room.id), day, start, session.durationMinutes)) continue
        options.push({ day, start, date: weekDates[day], roomId: room.id, score: 1 })
      }
    }
  }

  return options.slice(0, limit)
}
