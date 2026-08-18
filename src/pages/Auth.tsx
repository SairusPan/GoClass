import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../state/AuthContext'
import { Button } from '../components/ui'

type Mode = 'login' | 'signup' | 'forgot'

export default function Auth() {
  const { signUp, logIn, logInAsDemo, forgotPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [institutionName, setInstitutionName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [forgotUsername, setForgotUsername] = useState('')

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await logIn(loginUsername, loginPassword)
    setSubmitting(false)
    if (!result.ok) setError(result.error)
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await signUp({
      name: institutionName,
      adminName,
      username: signupUsername,
      email: signupEmail,
      password: signupPassword,
    })
    setSubmitting(false)
    if (!result.ok) setError(result.error)
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await forgotPassword(forgotUsername)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setForgotSent(true)
  }

  async function handleDemoLogin() {
    setError('')
    setSubmitting(true)
    const result = await logInAsDemo()
    setSubmitting(false)
    if (!result.ok) setError(result.error)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setForgotSent(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-xl font-semibold text-slate-900">GoClass</div>
          <p className="mt-1 text-sm text-slate-500">Scheduling for Australian tutoring centres</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {mode !== 'forgot' && (
            <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => switchMode('login')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Log in
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Register your centre
              </button>
            </div>
          )}

          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {mode === 'login' && (
            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Demo login: username <code className="rounded bg-white px-1 py-0.5 font-mono">demo</code> · password{' '}
              <code className="rounded bg-white px-1 py-0.5 font-mono">demo1234</code>
              <br />
              If your browser auto-fills different values, clear the fields first.
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Username">
                <input
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. demo"
                  autoComplete="username"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  autoComplete="current-password"
                />
              </Field>
              <div className="flex items-center justify-between">
                <Button type="submit" size="md" disabled={submitting}>
                  {submitting ? 'Logging in…' : 'Log in'}
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field label="Institution name">
                <input
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Harbour View Tutoring College"
                />
              </Field>
              <Field label="Your name (admin)">
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Username">
                <input
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  autoComplete="username"
                />
              </Field>
              <Field label="Email (used for password resets)">
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="admin@yourcentre.com"
                  autoComplete="email"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password">
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm password">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <Button type="submit" size="md" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}

          {mode === 'forgot' &&
            (forgotSent ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  If an account with that username exists, we've emailed a link to reset the password. It expires in
                  30 minutes.
                </div>
                <button
                  onClick={() => switchMode('login')}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  ← Back to log in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Enter your username and we'll email a reset link to the address on file for your centre.
                </p>
                <Field label="Username">
                  <input
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="username"
                  />
                </Field>
                <div className="flex items-center justify-between">
                  <Button type="submit" size="md" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    ← Back to log in
                  </button>
                </div>
              </form>
            ))}

          {mode !== 'forgot' && (
            <div className="mt-5 border-t border-slate-100 pt-5 text-center">
              <button
                onClick={handleDemoLogin}
                disabled={submitting}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-400"
              >
                Skip — try the demo account
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Backed by a real Spring Boot + MySQL API on localhost:8080 — accounts and passwords are stored server-side, not in this browser.
        </p>
      </div>
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
