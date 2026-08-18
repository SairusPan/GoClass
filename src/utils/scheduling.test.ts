import { describe, expect, it } from 'vitest'
import type { ClassGroup, Room, Teacher } from '../types'
import { findConflicts, findRescheduleOptions, findSubstitutes, generateSuggestions } from './scheduling'

function teacher(overrides: Partial<Teacher> & { id: string }): Teacher {
  return {
    name: overrides.id,
    subjects: [],
    availability: [],
    phone: '',
    email: '',
    ...overrides,
  }
}

function room(overrides: Partial<Room> & { id: string }): Room {
  return { name: overrides.id, capacity: 10, ...overrides }
}

function cls(overrides: Partial<ClassGroup> & { id: string }): ClassGroup {
  return {
    name: overrides.id,
    subjectId: 'sub-x',
    studentCount: 5,
    status: 'published',
    day: null,
    start: null,
    teacherId: null,
    roomId: null,
    date: null,
    ...overrides,
  }
}

describe('findConflicts', () => {
  it('reports nothing when classes sit at different times', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
      cls({ id: 'b', day: 'Mon', start: '17:00', teacherId: 't1', roomId: 'r1' }),
    ]
    expect(findConflicts(classes)).toHaveLength(0)
  })

  it('flags a teacher double-booked at the same day+time', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
      cls({ id: 'b', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r2' }),
    ]
    const conflicts = findConflicts(classes)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe('teacher')
  })

  it('flags a room double-booked at the same day+time', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
      cls({ id: 'b', day: 'Mon', start: '16:00', teacherId: 't2', roomId: 'r1' }),
    ]
    const conflicts = findConflicts(classes)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].type).toBe('room')
  })

  it('flags both a teacher and a room conflict independently when both clash', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
      cls({ id: 'b', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
    ]
    const conflicts = findConflicts(classes)
    expect(conflicts).toHaveLength(2)
    expect(conflicts.map((c) => c.type).sort()).toEqual(['room', 'teacher'])
  })

  it('ignores unscheduled classes even if they share a teacher/room/day/start', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1', status: 'unscheduled' }),
      cls({ id: 'b', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1', status: 'unscheduled' }),
    ]
    expect(findConflicts(classes)).toHaveLength(0)
  })

  it('does not confuse different days at the same clock time', () => {
    const classes = [
      cls({ id: 'a', day: 'Mon', start: '16:00', teacherId: 't1', roomId: 'r1' }),
      cls({ id: 'b', day: 'Tue', start: '16:00', teacherId: 't1', roomId: 'r1' }),
    ]
    expect(findConflicts(classes)).toHaveLength(0)
  })
})

describe('generateSuggestions', () => {
  const teachers = [
    teacher({ id: 't-match', subjects: ['sub-x'], availability: [{ day: 'Mon', start: '16:00', end: '18:00' }] }),
    teacher({ id: 't-other-subject', subjects: ['sub-y'], availability: [{ day: 'Mon', start: '16:00', end: '18:00' }] }),
  ]
  const rooms = [room({ id: 'r1', capacity: 10 })]

  it('only suggests teachers who teach the target subject', () => {
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled' })
    const suggestions = generateSuggestions(target, [target], teachers, rooms)
    expect(suggestions.every((s) => s.teacherId === 't-match')).toBe(true)
    expect(suggestions.some((s) => s.teacherId === 't-other-subject')).toBe(false)
  })

  it('never suggests a slot outside the teacher\'s declared availability', () => {
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled' })
    const suggestions = generateSuggestions(target, [target], teachers, rooms, 100)
    for (const s of suggestions) {
      expect(s.day).toBe('Mon')
      expect(s.start === '16:00' || s.start === '17:00').toBe(true)
    }
  })

  it('excludes a slot where the candidate teacher is already booked elsewhere', () => {
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled' })
    const alreadyBooked = cls({ id: 'booked', subjectId: 'sub-x', status: 'published', day: 'Mon', start: '16:00', teacherId: 't-match', roomId: 'r1' })
    const suggestions = generateSuggestions(target, [target, alreadyBooked], teachers, rooms, 100)
    expect(suggestions.some((s) => s.day === 'Mon' && s.start === '16:00')).toBe(false)
    // the other still-free slot for that teacher should still come through
    expect(suggestions.some((s) => s.day === 'Mon' && s.start === '17:00')).toBe(true)
  })

  it('excludes a room that is already occupied at that slot, even if the teacher is free', () => {
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled' })
    const roomTaken = cls({ id: 'other', subjectId: 'sub-y', status: 'published', day: 'Mon', start: '16:00', teacherId: 't-other-subject', roomId: 'r1' })
    const suggestions = generateSuggestions(target, [target, roomTaken], teachers, rooms, 100)
    expect(suggestions.some((s) => s.day === 'Mon' && s.start === '16:00')).toBe(false)
  })

  it('excludes rooms too small for the class', () => {
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled', studentCount: 8 })
    const smallRoom = [room({ id: 'tiny', capacity: 4 })]
    expect(generateSuggestions(target, [target], teachers, smallRoom, 100)).toHaveLength(0)
  })

  it('returns nothing when no teacher teaches the subject', () => {
    const target = cls({ id: 'target', subjectId: 'sub-nobody-teaches', status: 'unscheduled' })
    expect(generateSuggestions(target, [target], teachers, rooms)).toHaveLength(0)
  })

  it('respects the limit parameter', () => {
    const manyRooms = [room({ id: 'r1' }), room({ id: 'r2' }), room({ id: 'r3' })]
    const target = cls({ id: 'target', subjectId: 'sub-x', status: 'unscheduled' })
    const suggestions = generateSuggestions(target, [target], teachers, manyRooms, 2)
    expect(suggestions).toHaveLength(2)
  })
})

describe('findSubstitutes', () => {
  const awayTeacher = teacher({ id: 't-away', subjects: ['sub-x'], availability: [{ day: 'Mon', start: '16:00', end: '18:00' }] })
  const qualifiedFree = teacher({ id: 't-qualified-free', subjects: ['sub-x'], availability: [{ day: 'Mon', start: '16:00', end: '18:00' }] })
  const wrongSubject = teacher({ id: 't-wrong-subject', subjects: ['sub-y'], availability: [{ day: 'Mon', start: '16:00', end: '18:00' }] })
  const notAvailable = teacher({ id: 't-not-available', subjects: ['sub-x'], availability: [{ day: 'Tue', start: '16:00', end: '18:00' }] })
  const teachers = [awayTeacher, qualifiedFree, wrongSubject, notAvailable]

  const session = cls({ id: 'session', subjectId: 'sub-x', teacherId: 't-away', day: 'Mon', start: '16:00', status: 'published' })

  it('never proposes the teacher who is away', () => {
    const subs = findSubstitutes(session, [session], teachers)
    expect(subs.some((s) => s.teacherId === 't-away')).toBe(false)
  })

  it('excludes teachers who do not teach the subject', () => {
    const subs = findSubstitutes(session, [session], teachers)
    expect(subs.some((s) => s.teacherId === 't-wrong-subject')).toBe(false)
  })

  it('excludes teachers not available at that day/time', () => {
    const subs = findSubstitutes(session, [session], teachers)
    expect(subs.some((s) => s.teacherId === 't-not-available')).toBe(false)
  })

  it('includes a qualified, free teacher', () => {
    const subs = findSubstitutes(session, [session], teachers)
    expect(subs.map((s) => s.teacherId)).toContain('t-qualified-free')
  })

  it('excludes a qualified teacher who is already booked elsewhere at that exact slot', () => {
    const elsewhereBooked = cls({ id: 'elsewhere', subjectId: 'sub-y', teacherId: 't-qualified-free', day: 'Mon', start: '16:00', status: 'published' })
    const subs = findSubstitutes(session, [session, elsewhereBooked], teachers)
    expect(subs.some((s) => s.teacherId === 't-qualified-free')).toBe(false)
  })

  it('returns an empty list when the session has no day/start set', () => {
    const unscheduled = cls({ id: 'no-slot', subjectId: 'sub-x', teacherId: 't-away' })
    expect(findSubstitutes(unscheduled, [unscheduled], teachers)).toHaveLength(0)
  })
})

describe('findRescheduleOptions', () => {
  const flexTeacher = teacher({
    id: 't-flex',
    subjects: ['sub-x'],
    availability: [
      { day: 'Mon', start: '16:00', end: '18:00' },
      { day: 'Wed', start: '16:00', end: '17:00' },
    ],
  })
  const rooms = [room({ id: 'r1', capacity: 10 })]

  it('never re-offers the original slot', () => {
    const session = cls({ id: 'session', subjectId: 'sub-x', teacherId: 't-flex', day: 'Mon', start: '16:00', status: 'published' })
    const options = findRescheduleOptions(session, [session], flexTeacher, rooms, 100)
    expect(options.some((o) => o.day === 'Mon' && o.start === '16:00')).toBe(false)
  })

  it('only offers slots within the teacher\'s own availability', () => {
    const session = cls({ id: 'session', subjectId: 'sub-x', teacherId: 't-flex', day: 'Mon', start: '16:00', status: 'published' })
    const options = findRescheduleOptions(session, [session], flexTeacher, rooms, 100)
    for (const o of options) {
      const withinMon = o.day === 'Mon' && o.start === '17:00'
      const withinWed = o.day === 'Wed' && o.start === '16:00'
      expect(withinMon || withinWed).toBe(true)
    }
  })

  it('excludes a slot where the teacher already has another class booked', () => {
    const session = cls({ id: 'session', subjectId: 'sub-x', teacherId: 't-flex', day: 'Mon', start: '16:00', status: 'published' })
    const otherBooking = cls({ id: 'other', subjectId: 'sub-x', teacherId: 't-flex', day: 'Wed', start: '16:00', status: 'published' })
    const options = findRescheduleOptions(session, [session, otherBooking], flexTeacher, rooms, 100)
    expect(options.some((o) => o.day === 'Wed' && o.start === '16:00')).toBe(false)
  })

  it('returns nothing when the teacher has no other availability window at all', () => {
    const oneSlotTeacher = teacher({ id: 't-single', subjects: ['sub-x'], availability: [{ day: 'Mon', start: '16:00', end: '17:00' }] })
    const session = cls({ id: 'session', subjectId: 'sub-x', teacherId: 't-single', day: 'Mon', start: '16:00', status: 'published' })
    expect(findRescheduleOptions(session, [session], oneSlotTeacher, rooms, 100)).toHaveLength(0)
  })
})
