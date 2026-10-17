import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { HeartPulse } from 'lucide-react'
import { useApp } from '@/hooks/useApp'

export function Nav() {
  const demo = useApp((s) => s.demoMode)
  const alarm = useApp((s) => s.alarm.phase)
  const hasVitals = useApp((s) => Object.keys(s.vitals).length > 0)

  const pill =
    alarm !== 'idle'
      ? { text: 'Alarm', cls: 'bg-destructive text-primary-foreground', dot: 'bg-card animate-flash' }
      : demo
        ? { text: 'Demo', cls: 'bg-warning-soft text-warning', dot: 'bg-warning' }
        : hasVitals
          ? { text: 'Guarding', cls: 'bg-success-soft text-success', dot: 'bg-success' }
          : { text: 'No device', cls: 'bg-muted text-muted-foreground', dot: 'bg-secondary' }

  const link = 'px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition'
  const active = { className: `${link} !bg-secondary !text-primary-foreground` }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 ">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-destructive text-primary-foreground shadow-sm shadow-surface-shadow/30">
            <HeartPulse className="size-4.5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-bold tracking-normal">Lifeline</span>
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
