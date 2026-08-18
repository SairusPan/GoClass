import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import { Button } from '../components/ui'

export default function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const { resetPassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await resetPassword(token, newPassword)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-xl font-semibold text-slate-900">GoClass</div>
          <p className="mt-1 text-sm text-slate-500">Reset your password</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {done ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Your password has been reset. Any devices you were logged in on have been signed out for security.
              </div>
              <Button onClick={onDone}>Go to log in</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">Confirm new password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
              </label>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Resetting…' : 'Reset password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
