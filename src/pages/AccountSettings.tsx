import { useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { Button, Card } from '../components/ui'

export default function AccountSettings() {
  const { currentUser, updateProfile } = useAuth()
  const [name, setName] = useState(currentUser?.name ?? '')
  const [adminName, setAdminName] = useState(currentUser?.adminName ?? '')
  const [email, setEmail] = useState(currentUser?.email ?? '')
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const dirty =
    name !== (currentUser?.name ?? '') ||
    adminName !== (currentUser?.adminName ?? '') ||
    email !== (currentUser?.email ?? '')

  async function save() {
    setStatus(null)
    setIsSaving(true)
    const result = await updateProfile({ name: name.trim(), adminName: adminName.trim(), email: email.trim() })
    setIsSaving(false)
    setStatus(result.ok ? { tone: 'ok', text: 'Saved.' } : { tone: 'error', text: result.error })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Account settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your centre's details. These appear on the schedules and emails GoClass sends out.
        </p>
      </div>

      <Card className="max-w-xl space-y-4 p-5">
        <Field label="Centre name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Harbour View Tutoring College"
          />
        </Field>
        <Field label="Admin contact name">
          <input
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Alex Nguyen"
          />
        </Field>
        <Field label="Email (password reset links are sent here)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="admin@example.com"
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={!dirty || isSaving || !name.trim() || !adminName.trim() || !email.trim()}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
          {status && (
            <span className={`text-sm ${status.tone === 'ok' ? 'text-emerald-600' : 'text-red-700'}`}>
              {status.text}
            </span>
          )}
        </div>
      </Card>

      <Card className="max-w-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900">Login</h2>
        <p className="mt-2 text-sm text-slate-600">
          Username: <strong>{currentUser?.username}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Your username can't be changed — it's what you log in with. To change your password, log out and use
          "Forgot password?" so the reset link goes to the email above.
        </p>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}
