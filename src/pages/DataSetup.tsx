import { useRef, useState, type ReactNode } from 'react'
import { useScheduling } from '../state/SchedulingContext'
import { apiFetch, readError } from '../state/apiClient'
import { Badge, Button, Card } from '../components/ui'
import {
  DAYS,
  DAY_LABELS,
  DURATION_OPTIONS,
  TIME_SLOTS,
  type Availability,
  type ClassGroup,
  type Day,
  type Teacher,
} from '../types'

type Tab = 'teachers' | 'subjects' | 'rooms' | 'classes'

export default function DataSetup() {
  const [tab, setTab] = useState<Tab>('teachers')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Teachers &amp; setup data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your centre's teachers, subjects, rooms and classes, or import a CSV saved from Excel
          using the template on each tab. Importing does not schedule classes.
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
  const { teachers, subjects, addTeacher, updateTeacher, deleteTeacher } = useScheduling()
  const { error, clearError, run } = useActionError()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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

  function removeAvailabilityRow(index: number) {
    setAvailability((prev) => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setPhone('')
    setEmail('')
    setSelectedSubjects([])
    setAvailability([])
    setShowForm(false)
  }

  function startEdit(t: Teacher) {
    clearError()
    setEditingId(t.id)
    setName(t.name)
    setPhone(t.phone)
    setEmail(t.email)
    setSelectedSubjects(t.subjects)
    setAvailability(t.availability)
    setShowForm(true)
  }

  const canSubmit = Boolean(name.trim()) && selectedSubjects.length > 0 && availability.length > 0

  function submit() {
    if (!canSubmit) return
    const payload = { name: name.trim(), phone, email: email.trim(), subjects: selectedSubjects, availability }
    // Only clear the form once the write actually landed — a rejected save should leave
    // everything the user typed on screen next to the reason it failed.
    run(async () => {
      if (editingId) await updateTeacher(editingId, payload)
      else await addTeacher(payload)
      resetForm()
    })
  }

  function remove(t: Teacher) {
    if (!confirm(`Delete ${t.name}? This can't be undone.`)) return
    run(() => deleteTeacher(t.id))
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
      <CsvImportBar type="teachers" label="teachers" />
      <div className="flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or subject…"
          className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ Add teacher'}
        </Button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {showForm && (
        <Card className="space-y-4 p-5">
          {editingId && <h2 className="text-sm font-semibold text-slate-900">Editing {name || 'teacher'}</h2>}
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
                  <button key={i} onClick={() => removeAvailabilityRow(i)} title="Remove this window">
                    <Badge tone="blue">
                      {DAY_LABELS[a.day]} {a.start}–{a.end} ×
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </Field>

          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!canSubmit}>
              {editingId ? 'Save changes' : 'Save teacher'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Wide enough with the actions column that it can outgrow its card — scroll rather than
        * clip, or Edit/Delete become unreachable on a narrow window. */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Subjects</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3"></th>
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
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(t)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(t)}
                    className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
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
  const { subjects, addSubject, updateSubject, deleteSubject } = useScheduling()
  const { error, clearError, run } = useActionError()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function reset() {
    setEditingId(null)
    setName('')
  }

  function submit() {
    if (!name.trim()) return
    run(async () => {
      if (editingId) await updateSubject(editingId, name.trim())
      else await addSubject(name.trim())
      reset()
    })
  }

  return (
    <div className="space-y-4">
      <CsvImportBar type="subjects" label="subjects" />
      <Card className="flex flex-wrap items-end gap-2 p-4">
        <Field label={editingId ? 'Rename subject' : 'New subject name'}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. VCE Further Maths"
          />
        </Field>
        <Button onClick={submit} disabled={!name.trim()}>
          {editingId ? 'Save changes' : 'Add subject'}
        </Button>
        {editingId && (
          <Button variant="secondary" onClick={reset}>
            Cancel
          </Button>
        )}
      </Card>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      clearError()
                      setEditingId(s.id)
                      setName(s.name)
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"? This can't be undone.`)) run(() => deleteSubject(s.id))
                    }}
                    className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No subjects yet — add one above.</p>
        )}
      </Card>
    </div>
  )
}

function RoomsTab() {
  const { rooms, addRoom, updateRoom, deleteRoom } = useScheduling()
  const { error, clearError, run } = useActionError()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState(8)
  const [editingId, setEditingId] = useState<string | null>(null)

  function reset() {
    setEditingId(null)
    setName('')
    setCapacity(8)
  }

  function submit() {
    if (!name.trim()) return
    run(async () => {
      if (editingId) await updateRoom(editingId, name.trim(), capacity)
      else await addRoom(name.trim(), capacity)
      reset()
    })
  }

  return (
    <div className="space-y-4">
      <CsvImportBar type="rooms" label="rooms" />
      <Card className="flex flex-wrap items-end gap-2 p-4">
        <Field label={editingId ? 'Edit room name' : 'Room name'}>
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
        <Button onClick={submit} disabled={!name.trim()}>
          {editingId ? 'Save changes' : 'Add room'}
        </Button>
        {editingId && (
          <Button variant="secondary" onClick={reset}>
            Cancel
          </Button>
        )}
      </Card>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.capacity} seats</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      clearError()
                      setEditingId(r.id)
                      setName(r.name)
                      setCapacity(r.capacity)
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${r.name}"? This can't be undone.`)) run(() => deleteRoom(r.id))
                    }}
                    className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rooms.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">No rooms yet — add one above.</p>
        )}
      </Card>
    </div>
  )
}

function ClassesTab() {
  const { classes, subjects, addClass, updateClass, deleteClass } = useScheduling()
  const { error, clearError, run } = useActionError()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [studentCount, setStudentCount] = useState(6)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [search, setSearch] = useState('')

  function subjectName(id: string) {
    return subjects.find((s) => s.id === id)?.name ?? id
  }

  function reset() {
    setEditingId(null)
    setName('')
    setSubjectId(subjects[0]?.id ?? '')
    setStudentCount(6)
    setDurationMinutes(60)
  }

  function startEdit(c: ClassGroup) {
    clearError()
    setEditingId(c.id)
    setName(c.name)
    setSubjectId(c.subjectId)
    setStudentCount(c.studentCount)
    setDurationMinutes(c.durationMinutes)
  }

  function submit() {
    if (!name.trim() || !subjectId) return
    run(async () => {
      const payload = { name: name.trim(), subjectId, studentCount, durationMinutes }
      if (editingId) await updateClass(editingId, payload)
      else await addClass(payload)
      reset()
    })
  }

  const query = search.trim().toLowerCase()
  const filteredClasses = classes.filter(
    (c) => !query || c.name.toLowerCase().includes(query) || subjectName(c.subjectId).toLowerCase().includes(query),
  )

  return (
    <div className="space-y-4">
      <CsvImportBar type="classes" label="classes" />
      <Card className="flex flex-wrap items-end gap-2 p-4">
        <Field label={editingId ? 'Edit class name' : 'Class name'}>
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
        <Button onClick={submit} disabled={!name.trim() || !subjectId}>
          {editingId ? 'Save changes' : 'Add class'}
        </Button>
        {editingId && (
          <Button variant="secondary" onClick={reset}>
            Cancel
          </Button>
        )}
      </Card>

      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {subjects.length === 0 && (
        <p className="text-sm text-slate-500">Add a subject first (Subjects tab) before creating classes.</p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or subject…"
        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
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
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"? This can't be undone.`)) run(() => deleteClass(c.id))
                    }}
                    className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
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

function CsvImportBar({ type, label }: { type: Tab; label: string }) {
  const { importCsv } = useScheduling()
  const { error, clearError, run } = useActionError()
  const [ok, setOk] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    setOk('')
    return run(async () => {
      const res = await apiFetch(`/api/import/${type}/template`)
      if (!res.ok) throw new Error(await readError(res, 'Could not download the template.'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function pickFile() {
    setOk('')
    clearError()
    inputRef.current?.click()
  }

  function onFile(file: File | undefined) {
    if (!file) return
    run(async () => {
      const result = await importCsv(type, file)
      setOk(`Imported ${result.imported} ${label}.`)
    })
  }

  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={downloadTemplate}>
          Download CSV template
        </Button>
        <Button variant="secondary" onClick={pickFile}>
          Import {label} CSV
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            onFile(file)
          }}
        />
        <p className="text-xs text-slate-500">CSV only. All rows must be valid or nothing is imported.</p>
      </div>
      {error && <ErrorBanner message={error} onDismiss={clearError} />}
      {ok && !error && <p className="text-sm text-emerald-700">{ok}</p>}
    </Card>
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

/**
 * The backend refuses a delete with a 409 explaining exactly what still references the row
 * ("This subject is still used by 3 classes…"). Without this the rejected promise would vanish
 * into the console and the button would look like it simply did nothing.
 */
function useActionError() {
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    }
  }

  return { error, clearError: () => setError(''), run }
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <Card className="flex items-start justify-between gap-4 border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-700">{message}</p>
      <button onClick={onDismiss} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700">
        Dismiss
      </button>
    </Card>
  )
}
