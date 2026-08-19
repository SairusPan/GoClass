import { useState, type ReactNode } from 'react'
import { useScheduling } from '../state/SchedulingContext'
import { Badge, Button, Card } from '../components/ui'
import { DAYS, DAY_LABELS, DURATION_OPTIONS, TIME_SLOTS, type Availability, type Day } from '../types'

type Tab = 'teachers' | 'subjects' | 'rooms' | 'classes'

export default function DataSetup() {
  const [tab, setTab] = useState<Tab>('teachers')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Teachers &amp; setup data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your centre's teachers, subjects, rooms and classes. In a later version this will also support
          importing from Excel.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(['teachers', 'subjects', 'rooms', 'classes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'teachers' && <TeachersTab />}
      {tab === 'subjects' && <SubjectsTab />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'classes' && <ClassesTab />}
    </div>
  )
}

function TeachersTab() {
  const { teachers, subjects, addTeacher } = useScheduling()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [availDay, setAvailDay] = useState<Day>('Mon')
  const [availStart, setAvailStart] = useState(TIME_SLOTS[0])
  const [availEnd, setAvailEnd] = useState(TIME_SLOTS[TIME_SLOTS.length - 1])

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  function addAvailabilityRow() {
    setAvailability((prev) => [...prev, { day: availDay, start: availStart, end: availEnd }])
  }

  function resetForm() {
    setName('')
    setPhone('')
    setEmail('')
    setSelectedSubjects([])
    setAvailability([])
    setShowForm(false)
  }

  function submit() {
    if (!name.trim() || selectedSubjects.length === 0 || availability.length === 0) return
    addTeacher({ name: name.trim(), phone, email: email.trim(), subjects: selectedSubjects, availability })
    resetForm()
  }

  const query = search.trim().toLowerCase()
  const filteredTeachers = teachers.filter(
    (t) =>
      !query ||
      t.name.toLowerCase().includes(query) ||
      t.subjects.some((sid) => (subjects.find((s) => s.id === sid)?.name ?? '').toLowerCase().includes(query)),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or subject…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add teacher'}</Button>
      </div>

      {showForm && (
        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Alex Nguyen"
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="0412 345 678"
              />
            </Field>
          </div>

          <Field label="Email (leave requests / substitute confirmations get sent here)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="alex.nguyen@example.com"
            />
          </Field>

          <Field label="Subjects they can teach">
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSubject(s.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedSubjects.includes(s.id)
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Availability">
            <div className="flex flex-wrap items-end gap-2">
              <select
                value={availDay}
                onChange={(e) => setAvailDay(e.target.value as Day)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
              <select
                value={availStart}
                onChange={(e) => setAvailStart(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="pb-1.5 text-sm text-slate-400">to</span>
              <select
                value={availEnd}
                onChange={(e) => setAvailEnd(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={addAvailabilityRow}>
                + Add window
              </Button>
            </div>
            {availability.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {availability.map((a, i) => (
                  <Badge key={i} tone="blue">
                    {DAY_LABELS[a.day]} {a.start}–{a.end}
                  </Badge>
                ))}
              </div>
            )}
          </Field>

          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!name.trim() || selectedSubjects.length === 0 || availability.length === 0}>
              Save teacher
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Subjects</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeachers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.subjects.map((sid) => (
                      <Badge key={sid} tone="slate">
                        {subjects.find((s) => s.id === sid)?.name ?? sid}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex flex-wrap gap-1">
                    {t.availability.map((a, i) => (
                      <Badge key={i} tone="blue">
                        {a.day} {a.start}–{a.end}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{t.phone}</td>
                <td className="px-4 py-3 text-slate-500">{t.email || <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTeachers.length === 0 && query && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No teachers match "{search}".</p>
        )}
      </Card>
    </div>
  )
}

function SubjectsTab() {
  const { subjects, addSubject } = useScheduling()
  const [name, setName] = useState('')

  return (
    <div className="space-y-4">
      <Card className="flex items-end gap-2 p-4">
        <Field label="New subject name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. VCE Further Maths"
          />
        </Field>
        <Button
          onClick={() => {
            if (!name.trim()) return
            addSubject(name.trim())
            setName('')
          }}
        >
          Add subject
        </Button>
      </Card>
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <Badge key={s.id} tone="slate">
              {s.name}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}

function RoomsTab() {
  const { rooms, addRoom } = useScheduling()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(8)

  return (
    <div className="space-y-4">
      <Card className="flex items-end gap-2 p-4">
        <Field label="Room name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Room D"
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Button
          onClick={() => {
            if (!name.trim()) return
            addRoom(name.trim(), capacity)
            setName('')
          }}
        >
          Add room
        </Button>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.capacity} seats</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function ClassesTab() {
  const { classes, subjects, addClass, deleteClass } = useScheduling()
  const [name, setName] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [studentCount, setStudentCount] = useState(6)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [search, setSearch] = useState('')

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? id
  }

  const query = search.trim().toLowerCase()
  const filteredClasses = classes.filter(
    (c) => !query || c.name.toLowerCase().includes(query) || subjectName(c.subjectId).toLowerCase().includes(query),
  )

  return (
    <div className="space-y-4">
      <Card className="flex items-end gap-2 p-4">
        <Field label="Class name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Biology U1/2"
          />
        </Field>
        <Field label="Subject">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Students">
          <input
            type="number"
            min={1}
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Duration">
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </Field>
        <Button
          onClick={() => {
            if (!name.trim() || !subjectId) return
            addClass({ name: name.trim(), subjectId, studentCount, durationMinutes })
            setName('')
          }}
          disabled={!subjectId}
        >
          Add class
        </Button>
      </Card>

      {subjects.length === 0 && (
        <p className="text-sm text-slate-500">Add a subject first (Subjects tab) before creating classes.</p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or subject…"
        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredClasses.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{subjectName(c.subjectId)}</td>
                <td className="px-4 py-3 text-slate-600">{c.studentCount}</td>
                <td className="px-4 py-3 text-slate-600">{c.durationMinutes} min</td>
                <td className="px-4 py-3">
                  <Badge tone={c.status === 'published' ? 'green' : c.status === 'draft' ? 'amber' : 'slate'}>
                    {c.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"? This can't be undone.`)) deleteClass(c.id)
                    }}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredClasses.length === 0 && query && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No classes match "{search}".</p>
        )}
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
