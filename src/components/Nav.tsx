import { Link } from '@tanstack/react-router'
import { HeartPulse } from 'lucide-react'
import { useApp } from '@/hooks/useApp'

export function Nav() {
  const demo = useApp((s) => s.demoMode)
  const alarm = useApp((s) => s.alarm.phase)
  const hasVitals = useApp((s) => Object.keys(s.vitals).length > 0)

  const pill =
    alarm !== 'idle'
      ? { text: 'Alarm', cls: 'bg-rose-600 text-white', dot: 'bg-white animate-flash' }
      : demo
        ? { text: 'Demo', cls: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' }
        : hasVitals
          ? { text: 'Guarding', cls: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' }
          : { text: 'No device', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }

  const link = 'px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition'
  const active = { className: `${link} !bg-slate-900 !text-white` }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-600/30">
            <HeartPulse className="size-4.5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Lifeline</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/monitor" className={link} activeProps={active}>Monitor</Link>
          <Link to="/contacts" className={link} activeProps={active}>Contacts</Link>
        </nav>
        <span className={`ml-1 hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:flex ${pill.cls}`}>
          <span className={`size-1.5 rounded-full ${pill.dot}`} />
          {pill.text}
        </span>
      </div>
    </header>
  )
}
