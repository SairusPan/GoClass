import { useEffect, useMemo, useState, useCallback } from 'react'
import { useScheduling } from '../state/SchedulingContext'
import { Badge, Button, Card } from '../components/ui'
import { DAYS, DAY_LABELS, DURATION_OPTIONS, TIME_SLOTS, type ClassGroup, type ClassOverride, type Day } from '../types'
import { addMinutesToTime, applyWeekOverrides, findConflicts, generateSuggestions, type Suggestion } from '../utils/scheduling'
import { getWeekDates } from '../data/mockData'

export default function ScheduleBoard() {
  const { classes, teachers, rooms, subjects, assignClass, publishAllDrafts, fetchWeekOverrides } = useScheduling()
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const weekStart = weekDates.Mon
  const currentYear = new Date().getFullYear()
  const canGoBack = new Date(getWeekDates(weekOffset - 1).Mon).getFullYear() >= currentYear
  const canGoForward = new Date(getWeekDates(weekOffset + 1).Mon).getFullYear() <= currentYear

  const [overrides, setOverrides] = useState<ClassOverride[]>([])
  const refreshOverrides = useCallback(() => {
    fetchWeekOverrides(weekStart).then(setOverrides)
  }, [fetchWeekOverrides, weekStart])
  useEffect(() => {
    refreshOverrides()
  }, [refreshOverrides])

  // This week's real schedule — templates with any per-week overrides merged in. All rendering
  // and conflict-checking below uses this, not the raw templates, so a one-off change made to
  // this week is reflected here without touching other weeks.
  const effectiveClasses = useMemo(() => applyWeekOverrides(classes, overrides), [classes, overrides])
  const weekConflicts = useMemo(() => findConflicts(effectiveClasses), [effectiveClasses])

  const unscheduled = effectiveClasses.filter((c) => c.status === 'unscheduled')
  // Deliberately the template's draft count, not this week's — "Publish all drafts" bulk-publishes
  // template-level drafts (the normal add-a-class → suggest → apply → publish flow); it doesn't
  // know about per-week overrides, which are published individually from the edit panel instead.
  const draftCount = classes.filter((c) => c.status === 'draft').length

  const conflictClassIds = useMemo(
    () => new Set(weekConflicts.map((c) => c.classId).concat(weekConflicts.map((c) => c.withClassId))),
    [weekConflicts],
  )

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? id
  }
  function teacherName(id: string | null) {
    return teachers.find((t) => t.id === id)?.name ?? '—'
  }
  function roomName(id: string | null) {
    return rooms.find((r) => r.id === id)?.name ?? '—'
  }

  function runSuggestions() {
    const next: Record<string, Suggestion[]> = {}
    for (const cls of unscheduled) {
      next[cls.id] = generateSuggestions(cls, effectiveClasses, teachers, rooms)
    }
    setSuggestions(next)
  }

  function clearSuggestions() {
    setSuggestions({})
  }

  const suggestionsShown = Object.keys(suggestions).length > 0

  function applySuggestion(cls: ClassGroup, s: Suggestion) {
    assignClass(cls.id, { teacherId: s.teacherId, roomId: s.roomId, day: s.day, start: s.start, status: 'draft' })
    // Every other class's displayed suggestions were computed against the pre-apply snapshot of
    // `classes`, so they can now recommend a teacher/room/slot that clashes with what was just
    // applied. Clear them all rather than leave stale suggestions the admin could apply into a
    // fresh conflict — "Generate suggestions" recomputes from the current state on demand.
    setSuggestions({})
  }

  const editingClass = effectiveClasses.find((c) => c.id === editingId) ?? null
  const editingHasOverride = editingId != null && overrides.some((o) => o.classId === editingId)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Schedule builder</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate candidate time slots for unscheduled classes, resolve conflicts, then publish.
          </p>
        </div>
        <div className="flex gap-2">
          {suggestionsShown && (
            <Button variant="ghost" onClick={clearSuggestions}>
              ← Back to list
            </Button>
          )}
          <Button variant="secondary" onClick={runSuggestions} disabled={unscheduled.length === 0}>
            Generate suggestions ({unscheduled.length})
          </Button>
          <Button onClick={publishAllDrafts} disabled={draftCount === 0}>
            Publish all drafts ({draftCount})
          </Button>
        </div>
      </div>

      {weekConflicts.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Badge tone="red">{weekConflicts.length}</Badge>
            Conflicts detected this week — resolve before publishing
          </div>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {weekConflicts.map((c, i) => (
              <li key={i}>• {c.message}</li>
            ))}
          </ul>
        </Card>
      )}

      {unscheduled.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Unscheduled classes</h2>
          <div className="mt-3 space-y-3">
            {unscheduled.map((cls) => (
              <div key={cls.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-800">{cls.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {subjectName(cls.subjectId)} · {cls.studentCount} students · {cls.durationMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {!suggestions[cls.id] && <Badge tone="amber">Needs a slot</Badge>}
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(cls.id)}>
                      Schedule manually
                    </Button>
                    {suggestions[cls.id] && (
                      <button
                        onClick={() =>
                          setSuggestions((prev) => {
                            const next = { ...prev }
                            delete next[cls.id]
                            return next
                          })
                        }
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Hide
                      </button>
                    )}
                  </div>
                </div>

                {suggestions[cls.id] && (
                  <div className="mt-3 space-y-2">
                    {suggestions[cls.id].length === 0 && (
                      <p className="text-sm text-slate-500">
                        No candidate slot satisfies teacher availability + subject match + room capacity. Add
                        another qualified teacher or free up a room to unblock this class.
                      </p>
                    )}
                    {suggestions[cls.id].map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                        <span>
                          <strong>{teachers.find((t) => t.id === s.teacherId)?.name}</strong> · {DAY_LABELS[s.day]}{' '}
                          {s.start} · {rooms.find((r) => r.id === s.roomId)?.name}
                          <span className="ml-2 text-xs text-slate-400">{s.reason}</span>
                        </span>
                        <Button size="sm" onClick={() => applySuggestion(cls, s)}>
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Weekly timetable</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setWeekOffset((w) => w - 1)} disabled={!canGoBack}>
              ← Previous week
            </Button>
            {weekOffset !== 0 && (
              <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
                This week
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setWeekOffset((w) => w + 1)} disabled={!canGoForward}>
              Next week →
            </Button>
          </div>
        </div>
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-20 text-left text-xs font-medium text-slate-400">Time</th>
              {DAYS.map((d) => (
                <th key={d} className="text-left text-xs font-medium text-slate-500">
                  {DAY_LABELS[d]}
                  <div className="font-normal text-slate-400">{weekDates[d]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot}>
                <td className="align-top text-xs font-medium text-slate-400">{slot}</td>
                {DAYS.map((day) => {
                  const cellClasses = effectiveClasses.filter(
                    (c) => c.status !== 'unscheduled' && c.day === day && c.start === slot,
                  )
                  return (
                    <td key={day} className="align-top">
                      <div className="min-h-16 space-y-1">
                        {cellClasses.map((cls) => {
                          const hasConflict = conflictClassIds.has(cls.id)
                          const hasOverride = overrides.some((o) => o.classId === cls.id)
                          return (
                            <button
                              key={cls.id}
                              onClick={() => setEditingId(cls.id)}
                              className={`w-full rounded-md border px-2 py-1.5 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${
                                hasConflict
                                  ? 'border-red-400 bg-red-50 ring-2 ring-red-300'
                                  : cls.status === 'published'
                                    ? 'border-indigo-200 bg-indigo-50'
                                    : 'border-amber-200 bg-amber-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="font-medium text-slate-800">{cls.name}</div>
                                {hasOverride && <Badge tone="blue">This week</Badge>}
                              </div>
                              <div className="text-slate-500">{teacherName(cls.teacherId)}</div>
                              <div className="text-slate-400">{roomName(cls.roomId)}</div>
                              <div className="text-slate-400">
                                {cls.start}–{addMinutesToTime(cls.start as string, cls.durationMinutes)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editingClass && (
        <EditPanel
          cls={editingClass}
          templateStatus={classes.find((c) => c.id === editingId)?.status ?? 'unscheduled'}
          weekStart={weekStart}
          weekLabel={weekDates[editingClass.day ?? 'Mon']}
          hasOverride={editingHasOverride}
          onClose={() => setEditingId(null)}
          onSaved={refreshOverrides}
        />
      )}
    </div>
  )
}

function EditPanel({
  cls,
  templateStatus,
  weekStart,
  weekLabel,
  hasOverride,
  onClose,
  onSaved,
}: {
  cls: ClassGroup
  templateStatus: ClassGroup['status']
  weekStart: string
  weekLabel: string
  hasOverride: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { teachers, rooms, assignClass, publishClass, saveWeekOverride, clearWeekOverride } = useScheduling()
  const [teacherId, setTeacherId] = useState(cls.teacherId ?? teachers[0]?.id ?? '')
  const [roomId, setRoomId] = useState(cls.roomId ?? rooms[0]?.id ?? '')
  const [day, setDay] = useState<Day>(cls.day ?? 'Mon')
  const [start, setStart] = useState(cls.start ?? TIME_SLOTS[0])
  const [durationMinutes, setDurationMinutes] = useState(cls.durationMinutes)
  const [scope, setScope] = useState<'all' | 'week'>('all')

  function save() {
    if (scope === 'week') {
      saveWeekOverride(cls.id, weekStart, { teacherId, roomId, day, start, durationMinutes, status: 'draft' }).then(onSaved)
    } else {
      assignClass(cls.id, { teacherId, roomId, day, start, durationMinutes })
    }
    onClose()
  }

  async function saveAndPublish() {
    if (scope === 'week') {
      saveWeekOverride(cls.id, weekStart, { teacherId, roomId, day, start, durationMinutes, status: 'published' }).then(onSaved)
    } else {
      // publishClass() must run after assignClass() has actually committed, or it can race: if
      // assignClass's own status-defaulting write (unscheduled -> draft) lands after publish's,
      // the class ends up stuck on "draft" instead of "published".
      await assignClass(cls.id, { teacherId, roomId, day, start, durationMinutes })
      publishClass(cls.id)
    }
    onClose()
  }

  function revertToUsualSchedule() {
    clearWeekOverride(cls.id, weekStart).then(onSaved)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Edit {cls.name}</h3>
          <Badge tone={cls.status === 'published' ? 'green' : 'amber'}>{cls.status}</Badge>
        </div>

        <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            onClick={() => setScope('all')}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            Every week
          </button>
          <button
            onClick={() => setScope('week')}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              scope === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            This week only ({weekLabel})
          </button>
        </div>
        {scope === 'week' && (
          <p className="mt-2 text-xs text-slate-400">
            Only changes the week you're viewing — every other week keeps its usual schedule.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Teacher</span>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Room</span>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.capacity} seats)
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Day</span>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value as Day)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-500">Start time</span>
              <select
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Duration</span>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Manual changes are allowed even if they create a conflict — the timetable will flag it in red so you can
          see the clash instead of being blocked outright.
        </p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {scope === 'week' && hasOverride && (
              <button onClick={revertToUsualSchedule} className="text-xs font-medium text-red-500 hover:text-red-700">
                Revert to usual schedule
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save}>
              Save changes
            </Button>
            {/* A brand-new override always starts unpublished regardless of the template's
             * status — only treat "published" as final once this scope actually has that status. */}
            {(scope === 'week' ? !hasOverride || cls.status !== 'published' : templateStatus !== 'published') && (
              <Button onClick={saveAndPublish}>Save &amp; publish</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
