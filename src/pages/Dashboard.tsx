import { useScheduling } from '../state/SchedulingContext'
import { Badge, Button, Card } from '../components/ui'

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { classes, teachers, conflicts, leaveRecords, notifications } = useScheduling()

  const published = classes.filter((c) => c.status === 'published').length
  const draft = classes.filter((c) => c.status === 'draft').length
  const unscheduled = classes.filter((c) => c.status === 'unscheduled').length
  const pendingLeave = leaveRecords.filter((r) => r.resolution === 'pending').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Term 3, Week 5 overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          A quick snapshot of this week's timetable status for your centre.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Published sessions" value={published} tone="green" />
        <Stat label="Draft sessions" value={draft} tone="amber" />
        <Stat label="Unscheduled classes" value={unscheduled} tone="slate" />
        <Stat label="Conflicts detected" value={conflicts.length} tone={conflicts.length ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
          <div className="mt-3 space-y-2">
            {conflicts.length > 0 && (
              <AlertRow
                tone="red"
                text={`${conflicts.length} scheduling conflict${conflicts.length > 1 ? 's' : ''} found in the current timetable`}
                action="Resolve now"
                onAction={() => onNavigate('schedule')}
              />
            )}
            {unscheduled > 0 && (
              <AlertRow
                tone="amber"
                text={`${unscheduled} class${unscheduled > 1 ? 'es' : ''} still without a time slot`}
                action="Generate suggestions"
                onAction={() => onNavigate('schedule')}
              />
            )}
            {pendingLeave > 0 && (
              <AlertRow
                tone="blue"
                text={`${pendingLeave} leave request${pendingLeave > 1 ? 's' : ''} awaiting a substitute or reschedule`}
                action="Review"
                onAction={() => onNavigate('leave')}
              />
            )}
            {conflicts.length === 0 && unscheduled === 0 && pendingLeave === 0 && (
              <p className="text-sm text-slate-500">All clear — nothing needs your attention right now.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Recent notifications queued</h2>
          <div className="mt-3 space-y-2">
            {notifications.length === 0 && (
              <p className="text-sm text-slate-500">No notifications yet — these appear after you resolve a leave request.</p>
            )}
            {notifications.slice(0, 4).map((n) => (
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

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Roster</h2>
        <p className="mt-1 text-xs text-slate-500">{teachers.length} teachers configured</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {teachers.map((t) => (
            <Badge key={t.id} tone="slate">
              {t.name}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'slate' | 'red' }) {
  const toneClasses: Record<string, string> = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700',
    red: 'text-red-600',
  }
  return (
    <Card className="p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneClasses[tone]}`}>{value}</div>
    </Card>
  )
}

function AlertRow({
  tone,
  text,
  action,
  onAction,
}: {
  tone: 'red' | 'amber' | 'blue'
  text: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Badge tone={tone}>!</Badge>
        <span className="text-sm text-slate-700">{text}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}
