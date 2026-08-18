import { DAYS, TIME_SLOTS, type ClassGroup, type Conflict, type Day, type Room, type Teacher } from '../types'
import { WEEK_DATES } from '../data/mockData'

function slotWithinAvailability(day: Day, start: string, teacher: Teacher): boolean {
  return teacher.availability.some((a) => a.day === day && start >= a.start && start < a.end)
}

/** Scans every scheduled/draft/published class and flags teacher or room double-bookings. */
export function findConflicts(classes: ClassGroup[]): Conflict[] {
  const conflicts: Conflict[] = []
  const active = classes.filter((c) => c.status !== 'unscheduled' && c.day && c.start)

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.day !== b.day || a.start !== b.start) continue

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
  const busyByTeacher = new Map<string, Set<string>>()
  const busyByRoom = new Map<string, Set<string>>()

  allClasses
    .filter((c) => c.status !== 'unscheduled' && c.id !== target.id && c.day && c.start)
    .forEach((c) => {
      const key = `${c.day}|${c.start}`
      if (c.teacherId) {
        if (!busyByTeacher.has(c.teacherId)) busyByTeacher.set(c.teacherId, new Set())
        busyByTeacher.get(c.teacherId)!.add(key)
      }
      if (c.roomId) {
        if (!busyByRoom.has(c.roomId)) busyByRoom.set(c.roomId, new Set())
        busyByRoom.get(c.roomId)!.add(key)
      }
    })

  const suitableRooms = rooms.filter((r) => r.capacity >= target.studentCount)
  const candidates: Suggestion[] = []

  for (const teacher of eligibleTeachers) {
    for (const day of DAYS) {
      for (const start of TIME_SLOTS) {
        if (!slotWithinAvailability(day, start, teacher)) continue
        const key = `${day}|${start}`
        if (busyByTeacher.get(teacher.id)?.has(key)) continue

        for (const room of suitableRooms) {
          if (busyByRoom.get(room.id)?.has(key)) continue

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
  const key = `${session.day}|${session.start}`

  const busyTeacherIds = new Set(
    allClasses
      .filter((c) => c.id !== session.id && c.status !== 'unscheduled' && `${c.day}|${c.start}` === key)
      .map((c) => c.teacherId)
      .filter(Boolean) as string[],
  )

  return teachers
    .filter((t) => t.id !== session.teacherId)
    .filter((t) => t.subjects.includes(session.subjectId))
    .filter((t) => slotWithinAvailability(session.day as Day, session.start as string, t))
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
  const busyByTeacher = new Set(
    allClasses
      .filter((c) => c.id !== session.id && c.status !== 'unscheduled' && c.teacherId === teacher.id)
      .map((c) => `${c.day}|${c.start}`),
  )
  const busyByRoom = new Map<string, Set<string>>()
  allClasses
    .filter((c) => c.id !== session.id && c.status !== 'unscheduled' && c.roomId)
    .forEach((c) => {
      const key = `${c.day}|${c.start}`
      if (!busyByRoom.has(c.roomId as string)) busyByRoom.set(c.roomId as string, new Set())
      busyByRoom.get(c.roomId as string)!.add(key)
    })

  const suitableRooms = rooms.filter((r) => r.capacity >= session.studentCount)
  const options: RescheduleOption[] = []

  for (const day of DAYS) {
    for (const start of TIME_SLOTS) {
      if (day === session.day && start === session.start) continue
      if (!slotWithinAvailability(day, start, teacher)) continue
      const key = `${day}|${start}`
      if (busyByTeacher.has(key)) continue

      for (const room of suitableRooms) {
        if (busyByRoom.get(room.id)?.has(key)) continue
        options.push({ day, start, date: WEEK_DATES[day], roomId: room.id, score: 1 })
      }
    }
  }

  return options.slice(0, limit)
}
