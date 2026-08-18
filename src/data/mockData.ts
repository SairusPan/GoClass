// Concrete calendar dates for the demo week (Mon 17 Aug - Sat 22 Aug 2026). The rest of the
// original seed dataset (teachers, subjects, rooms, classes) now lives server-side —
// see backend/src/main/java/com/tutortime/schedule/DemoSeedService.java, which seeds every
// newly-registered institution with the same data this file used to hold.
export const WEEK_DATES: Record<string, string> = {
  Mon: '2026-08-17',
  Tue: '2026-08-18',
  Wed: '2026-08-19',
  Thu: '2026-08-20',
  Fri: '2026-08-21',
  Sat: '2026-08-22',
}
