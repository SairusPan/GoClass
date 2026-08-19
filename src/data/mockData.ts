import { DAYS, type Day } from '../types'

// The rest of the original seed dataset (teachers, subjects, rooms, classes) now lives
// server-side — see backend/src/main/java/com/tutortime/schedule/DemoSeedService.java, which
// seeds the one-click demo account with the data this file used to hold.

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Classes recur weekly by day-of-week, not by a fixed calendar date — this computes each day's
 * concrete date for the week `weekOffset` weeks from the current one (Mon-Sun containing today),
 * fresh on every call, so the timetable rolls forward automatically instead of staying pinned to
 * one fixed week. Kept in lockstep with the backend's WeekDates.forDay(). */
export function getWeekDates(weekOffset = 0): Record<Day, string> {
  const today = new Date()
  const isoDayIndex = today.getDay() === 0 ? 7 : today.getDay() // Mon=1..Sun=7
  const monday = new Date(today)
  monday.setDate(today.getDate() - (isoDayIndex - 1) + weekOffset * 7)

  const result = {} as Record<Day, string>
  DAYS.forEach((day, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    result[day] = toISODate(d)
  })
  return result
}
