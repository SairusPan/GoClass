import { useMemo, useState } from 'react'
import { useScheduling } from '../state/SchedulingContext'
import { Badge, Button, Card } from '../components/ui'
import { DAYS, DAY_LABELS, TIME_SLOTS, type ClassGroup, type Day } from '../types'
import { generateSuggestions, type Suggestion } from '../utils/scheduling'
import { WEEK_DATES } from '../data/mockData'

export default function ScheduleBoard() {
  const { classes, teachers, rooms, subjects, conflicts, assignClass, publishAllDrafts } = useScheduling()
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  const unscheduled = classes.filter((c) => c.status === 'unscheduled')
  const draftCount = classes.filter((c) => c.status === 'draft').length

  const conflictClassIds = useMemo(() => new Set(conflicts.map((c) => c.classId).concat(conflicts.map((c) => c.withClassId))), [conflicts])

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
      next[cls.id] = generateSuggestions(cls, classes, teachers, rooms)
    }
    setSuggestions(next)
  }

  function clearSuggestions() {
    setSuggestions({})
  }

  const suggestionsShown = Object.keys(suggestions).length > 0

  function applySuggestion(cls: ClassGroup, s: Suggestion) {
    assignClass(cls.id, { teacherId: s.teacherId, roomId: s.roomId, day: s.day, start: s.start, status: 'draft' })
    setSuggestions((prev) => {
      const next = { ...prev }
      delete next[cls.id]
      return next
    })
  }

  const editingClass = classes.find((c) => c.id === editingId) ?? null

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

      {conflicts.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <Badge tone="red">{conflicts.length}</Badge>
            Conflicts detected — resolve before publishing
          </div>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {conflicts.map((c, i) => (
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
                      {subjectName(cls.subjectId)} · {cls.studentCount} students
                    </span>
                  </div>
                  {!suggestions[cls.id] && <Badge tone="amber">Needs a slot</Badge>}
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Weekly timetable</h2>
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-20 text-left text-xs font-medium text-slate-400">Time</th>
              {DAYS.map((d) => (
                <th key={d} className="text-left text-xs font-medium text-slate-500">
                  {DAY_LABELS[d]}
                  <div className="font-normal text-slate-400">{WEEK_DATES[d]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot}>
                <td className="align-top text-xs font-medium text-slate-400">{slot}</td>
                {DAYS.map((day) => {
                  const cellClasses = classes.filter(
                    (c) => c.status !== 'unscheduled' && c.day === day && c.start === slot,
                  )
                  return (
                    <td key={day} className="align-top">
                      <div className="min-h-16 space-y-1">
                        {cellClasses.map((cls) => {
                          const hasConflict = conflictClassIds.has(cls.id)
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
                              <div className="font-medium text-slate-800">{cls.name}</div>
                              <div className="text-slate-500">{teacherName(cls.teacherId)}</div>
                              <div className="text-slate-400">{roomName(cls.roomId)}</div>
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

      {editingClass && <EditPanel cls={editingClass} onClose={() => setEditingId(null)} />}
    </div>
  )
}

function EditPanel({ cls, onClose }: { cls: ClassGroup; onClose: () => void }) {
  const { teachers, rooms, assignClass, publishClass } = useScheduling()
  const [teacherId, setTeacherId] = useState(cls.teacherId ?? '')
  const [roomId, setRoomId] = useState(cls.roomId ?? '')
  const [day, setDay] = useState<Day>(cls.day ?? 'Mon')
  const [start, setStart] = useState(cls.start ?? TIME_SLOTS[0])

  function save() {
    assignClass(cls.id, { teacherId, roomId, day, start })
    onClose()
  }

  function saveAndPublish() {
    assignClass(cls.id, { teacherId, roomId, day, start })
    publishClass(cls.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Edit {cls.name}</h3>
          <Badge tone={cls.status === 'published' ? 'green' : 'amber'}>{cls.status}</Badge>
        </div>

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
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Manual changes are allowed even if they create a conflict — the timetable will flag it in red so you can
          see the clash instead of being blocked outright.
        </p>

        <div className="mt-5 flex justify-between">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save}>
              Save changes
            </Button>
            {cls.status !== 'published' && <Button onClick={saveAndPublish}>Save &amp; publish</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}
