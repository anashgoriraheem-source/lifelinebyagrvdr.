import { Link } from '@tanstack/react-router'
import { Activity, HeartPulse, House, LifeBuoy, Users } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { isStale } from '@/lib/detection'

export function Nav() {
  const demo = useApp((s) => s.demoMode)
  const alarm = useApp((s) => s.alarm.phase)
  const device = useApp((s) => s.device.status)
  const vitals = useApp((s) => s.vitals)
  const now = useNow()
  const fresh = Object.entries(vitals).some(([k,r]) => r && !isStale(k as keyof typeof vitals,r,now))
  const status = alarm !== 'idle' ? 'Alert active' : demo ? 'Demo mode' : device === 'connected' && fresh ? 'Receiving readings' : device === 'connected' ? 'Waiting for readings' : 'Monitoring inactive'
  return <header className="relative z-30 border-b border-border bg-background">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-4 sm:px-6">
      <Link to="/" className="mr-auto flex items-center gap-3" aria-label="Lifeline home"><span className="grid size-10 place-items-center rounded-lg border border-border text-primary"><HeartPulse className="size-6" strokeWidth={1.6}/></span><span className="font-display text-xl font-bold">Lifeline<span className="ml-1 text-primary">.</span></span></Link>
      <nav aria-label="Main navigation" className="app-nav flex items-center gap-1">
        <Link to="/" className="app-nav-link" activeOptions={{exact:true}}><House className="size-4"/>Home</Link>
        <Link to="/monitor" className="app-nav-link"><Activity className="size-4"/>Monitor</Link>
        <Link to="/contacts" className="app-nav-link"><Users className="size-4"/>Contacts</Link>
        <Link to="/saath" className="app-nav-link"><LifeBuoy className="size-4"/>Saath</Link>
      </nav>
      <span role="status" className={`hidden items-center gap-2 text-xs sm:flex ${alarm !== 'idle' ? 'text-critical' : 'text-muted-foreground'}`}><span className={`size-1.5 rounded-full ${demo ? 'bg-warning' : device === 'connected' && fresh ? 'bg-success' : 'bg-muted-foreground'}`}/>{status}</span>
    </div>
  </header>
}
