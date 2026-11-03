import { Link } from '@tanstack/react-router'
import { Bluetooth, ChevronRight, MapPin, UserRound, Users } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { VITAL_META, isStale } from '@/lib/detection'

type Status = 'ready' | 'todo' | 'untested'

const BADGE: Record<Status, { label: string; cls: string }> = {
  ready: { label: 'Set up', cls: 'bg-success-soft text-success' },
  todo: { label: 'To do', cls: 'bg-warning-soft text-warning' },
  untested: { label: 'Not tested', cls: 'bg-muted text-muted-foreground' },
}

/** Emergency readiness checklist. Shows what is configured, missing, or simply untested. */
export function SetupChecklist() {
  const contacts = useApp((s) => s.contacts)
  const device = useApp((s) => s.device)
  const location = useApp((s) => s.location)
  const profile = useApp((s) => s.profile)
  const vitals = useApp((s) => s.vitals)
  const userId = useApp((s) => s.userId)
  const now = useNow()

  const vitalKeys = Object.keys(VITAL_META) as (keyof typeof VITAL_META)[]
  const receiving = device.status === 'connected' && vitalKeys.some((k) => vitals[k] && !isStale(k, vitals[k], now))
  const items: { icon: typeof Users; title: string; value: string; status: Status; to: '/contacts' | '/monitor' | '/account' }[] = [
    {
      icon: Users,
      title: 'Emergency contacts',
      value: contacts.length ? `${contacts.length} saved${userId ? ' in your account' : ' in this browser only'}` : 'None saved yet',
      status: contacts.length ? 'ready' : 'todo',
      to: '/contacts',
    },
    {
      icon: Bluetooth,
      title: 'Supported device',
      value: device.status === 'connected' ? `${device.name ?? 'Device'} connected` : 'Not connected — Chrome or Edge, Android or desktop',
      status: receiving ? 'ready' : device.status === 'connected' ? 'untested' : 'todo',
      to: '/monitor',
    },
    {
      icon: MapPin,
      title: 'Location permission',
      value: location.status === 'tracking' ? 'Allowed and tracking' : location.status === 'denied' ? 'Blocked in the browser' : location.status === 'requesting' ? 'Asking…' : 'Not turned on yet',
      status: location.status === 'tracking' ? 'ready' : 'todo',
      to: '/monitor',
    },
    {
      icon: UserRound,
      title: 'Medical profile',
      value: profile.name && profile.age != null ? `${profile.name} · age ${profile.age}` : 'Name and age missing',
      status: profile.name && profile.age != null ? 'ready' : 'todo',
      to: '/account',
    },
  ]

  return (
    <section className="mt-8" aria-label="Emergency setup checklist">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Emergency setup</h2>
        <span className="text-xs text-muted-foreground">AAPDA SETU never contacts anyone automatically</span>
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {items.map((x) => (
          <li key={x.title}>
            <Link to={x.to} className="flex items-center gap-3 py-4">
              <x.icon className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {x.title}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${BADGE[x.status].cls}`}>{BADGE[x.status].label}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{x.value}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Contacts, profile and limits are stored in this browser until you sign in and save them to your private account — they are not backed up automatically. Device compatibility has not been verified with specific watch or sensor models.
      </p>
    </section>
  )
}
