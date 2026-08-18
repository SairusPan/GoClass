import { useMemo, useState } from 'react'
import { useScheduling } from '../state/SchedulingContext'
import { Badge, Button, Card } from '../components/ui'
import { DAY_LABELS, type Day } from '../types'
import { findRescheduleOptions, findSubstitutes } from '../utils/scheduling'

export default function LeaveSubstitute() {
  const { classes, teachers, subjects, leaveRecords, notifications, fileLeave, resolveWithSubstitute, resolveWithReschedule } =
    useScheduling()

  const scheduledSessions = classes.filter((c) => c.status !== 'unscheduled' && c.teacherId)
  const [selectedClassId, setSelectedClassId] = useState(scheduledSessions[0]?.id ?? '')
  const [reason, setReason] = useState('')

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? id
  }
  function teacherName(id: string | null) {
    return teachers.find((t) => t.id === id)?.name ?? '—'
  }

  function submitLeave() {
    if (!selectedClassId) return
    fileLeave(selectedClassId, reason.trim() || 'No reason given')
    setReason('')
  }

  const pending = leaveRecords.filter((r) => r.resolution === 'pending')
  const resolved = leaveRecords.filter((r) => r.resolution !== 'pending')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Leave &amp; substitute</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mark a teacher away for a class, then let the system look for a qualified, available substitute — or a
          make-up slot if nobody is free.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">File a leave request</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Class / session</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-80 rounded-lg border border-slate-300 px-3 py-2"
            >
              {scheduledSessions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({subjectName(c.subjectId)}) — {teacherName(c.teacherId)} · {c.day} {c.start} ({c.date})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Reason (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-64 rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. Sick leave"
            />
          </label>
          <Button onClick={submitLeave} disabled={!selectedClassId}>
            Mark teacher away
          </Button>
        </div>
      </Card>

      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Pending — needs cover</h2>
          {pending.map((record) => (
            <PendingLeaveCard
              key={record.id}
              recordId={record.id}
              classId={record.classId}
              reason={record.reason}
              onSubstitute={resolveWithSubstitute}
              onReschedule={resolveWithReschedule}
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Resolved leave requests</h2>
          <div className="mt-3 space-y-2">
            {resolved.map((r) => {
              const cls = classes.find((c) => c.id === r.classId)
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>
                    <strong>{cls?.name}</strong> — {r.reason}
                  </span>
                  {r.resolution === 'substitute' ? (
                    <Badge tone="green">Covered by {teacherName(r.resolvedTeacherId ?? null)}</Badge>
                  ) : (
                    <Badge tone="blue">
                      Rescheduled to {r.resolvedDay && DAY_LABELS[r.resolvedDay]} {r.resolvedStart} ({r.resolvedDate})
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Notification queue</h2>
        <p className="mt-1 text-xs text-slate-500">
          These would be sent by email/SMS in a full version. For this demo they are just listed here.
        </p>
        <div className="mt-3 space-y-2">
          {notifications.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
          {notifications.map((n) => (
            <div key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Badge tone={n.audience === 'teacher' ? 'blue' : 'slate'}>
                {n.audience === 'teacher' ? 'Teacher' : 'Student/Parent'}
              </Badge>
              <p className="mt-1">{n.message}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function PendingLeaveCard({
  recordId,
  classId,
  reason,
  onSubstitute,
  onReschedule,
}: {
  recordId: string
  classId: string
  reason: string
  onSubstitute: (leaveId: string, teacherId: string) => void
  onReschedule: (leaveId: string, day: Day, start: string, roomId: string) => void
}) {
  const { classes, teachers, rooms, subjects } = useScheduling()
  const session = classes.find((c) => c.id === classId) ?? null
  const originalTeacher = session ? teachers.find((t) => t.id === session.teacherId) ?? null : null
  const substitutes = useMemo(
    () => (session ? findSubstitutes(session, classes, teachers) : []),
    [session, classes, teachers],
  )
  const rescheduleOptions = useMemo(
    () =>
      session && substitutes.length === 0 && originalTeacher
        ? findRescheduleOptions(session, classes, originalTeacher, rooms)
        : [],
    [substitutes, session, classes, originalTeacher, rooms],
  )

  if (!session) return null

  return (
    <Card className="border-amber-200 bg-amber-50/40 p-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-slate-800">{session.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            {subjects.find((s) => s.id === session.subjectId)?.name} · {session.day} {session.start} ({session.date})
          </span>
        </div>
        <Badge tone="amber">Away: {originalTeacher?.name}</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">Reason: {reason}</p>

      {substitutes.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Available substitutes</p>
          {substitutes.map((s) => {
            const t = teachers.find((tt) => tt.id === s.teacherId)
            return (
              <div key={s.teacherId} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm">
                <span>
                  <strong>{t?.name}</strong>
                  <span className="ml-2 text-xs text-slate-400">{s.reason}</span>
                </span>
                <Button size="sm" onClick={() => onSubstitute(recordId, s.teacherId)}>
                  Confirm as cover
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            No qualified substitute is free at this time — suggested make-up slots for {originalTeacher?.name}
          </p>
          {rescheduleOptions.length === 0 && (
            <p className="text-sm text-slate-500">
              No make-up slot found within this teacher's availability either — this needs a manual look.
            </p>
          )}
          {rescheduleOptions.map((opt, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm">
              <span>
                {DAY_LABELS[opt.day]} {opt.start} ({opt.date}) · {rooms.find((r) => r.id === opt.roomId)?.name}
              </span>
              <Button size="sm" onClick={() => onReschedule(recordId, opt.day, opt.start, opt.roomId)}>
                Confirm make-up time
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
