import { useState } from 'react'
import { SchedulingProvider, useScheduling } from './state/SchedulingContext'
import { AuthProvider, useAuth } from './state/AuthContext'
import Dashboard from './pages/Dashboard'
import DataSetup from './pages/DataSetup'
import ScheduleBoard from './pages/ScheduleBoard'
import LeaveSubstitute from './pages/LeaveSubstitute'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import { Badge } from './components/ui'

type Page = 'dashboard' | 'data' | 'schedule' | 'leave'

const NAV: { id: Page; label: string; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Overview' },
  { id: 'data', label: 'Teachers & Setup', hint: 'Data entry' },
  { id: 'schedule', label: 'Schedule Builder', hint: 'Suggest + resolve conflicts' },
  { id: 'leave', label: 'Leave & Substitute', hint: 'Cover a teacher absence' },
]

function Shell() {
  const [page, setPage] = useState<Page>('dashboard')
  const { conflicts, notifications, isLoading: schedulingLoading } = useScheduling()
  const { currentUser, logOut } = useAuth()

  if (schedulingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        Loading your centre's data…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="text-lg font-semibold text-slate-900">GoClass</div>
          <div className="text-xs text-slate-500">Scheduling for tutoring centres — demo build</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors ${
                page === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex w-full items-center justify-between text-sm font-medium">
                {item.label}
                {item.id === 'schedule' && conflicts.length > 0 && <Badge tone="red">{conflicts.length}</Badge>}
                {item.id === 'leave' && notifications.length > 0 && <Badge tone="blue">{notifications.length}</Badge>}
              </span>
              <span className="text-xs text-slate-400">{item.hint}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-800">{currentUser?.name}</div>
          <div className="text-xs text-slate-400">{currentUser?.adminName}</div>
          <button onClick={logOut} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Log out
          </button>
          <p className="mt-3 text-[11px] leading-snug text-slate-400">
            Backed by Spring Boot + MySQL, isolated per institution — your teachers, classes and
            timetable are saved server-side, not just in this browser tab.
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          {page === 'dashboard' && <Dashboard onNavigate={(p) => setPage(p as Page)} />}
          {page === 'data' && <DataSetup />}
          {page === 'schedule' && <ScheduleBoard />}
          {page === 'leave' && <LeaveSubstitute />}
        </div>
      </main>
    </div>
  )
}

function Gate() {
  const { currentUser, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
        Loading…
      </div>
    )
  }
  if (!currentUser) return <Auth />
  return (
    <SchedulingProvider>
      <Shell />
    </SchedulingProvider>
  )
}

function Root() {
  // No router in this demo — just detect the password-reset link's query param directly.
  const params = new URLSearchParams(window.location.search)
  const resetToken = window.location.pathname === '/reset-password' ? params.get('token') : null

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          window.location.href = '/'
        }}
      />
    )
  }
  return <Gate />
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
