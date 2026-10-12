import { Activity, Droplet, Gauge, Wind } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { VITAL_META, classify, formatReading, isStale } from '@/lib/detection'
import type { VitalKey, VitalStatus } from '@/lib/types'
import { Sparkline } from './Sparkline'

const ICON = { bp: Gauge, glucose: Droplet, hr: Activity, spo2: Wind }

const STATUS: Record<VitalStatus, { label: string; badge: string; text: string; line: string }> = {
  normal: { label: 'Normal', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', text: 'text-slate-900', line: '#10b981' },
  warning: { label: 'Watch', badge: 'bg-amber-50 text-amber-800 ring-amber-200', text: 'text-amber-700', line: '#f59e0b' },
  critical: { label: 'Critical', badge: 'bg-rose-600 text-white ring-rose-600', text: 'text-rose-600', line: '#e11d48' },
  unknown: { label: 'No data', badge: 'bg-slate-100 text-slate-500 ring-slate-200', text: 'text-slate-300', line: '#94a3b8' },
}

export function VitalCard({ k, delay = 0 }: { k: VitalKey; delay?: number }) {
  const r = useApp((s) => s.vitals[k])
  const t = useApp((s) => s.thresholds[k])
  const hist = useApp((s) => s.history[k])
  const demo = useApp((s) => s.demoMode)
  const now = useNow()
  const meta = VITAL_META[k]
  const Icon = ICON[k]
  const stale = r ? isStale(k, r, now) : false
  const status: VitalStatus = !r || stale ? 'unknown' : classify(k, r, t)
  const st = STATUS[status]
  const ago = r ? Math.max(0, Math.round((now - r.measuredAt) / 1000)) : null
  const intermittent = k === 'bp' || k === 'glucose'
  const source = demo ? 'Demo' : !r ? 'Not provided' : stale ? 'Signal lost' : intermittent ? 'Last measured' : 'Live'

  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-fade-up relative flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 transition ${status === 'critical' ? 'ring-2 ring-rose-500 shadow-rose-200' : 'ring-slate-200'}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon className="size-4" /></span>
        <h3 className="mr-auto text-sm font-semibold text-slate-600">{meta.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${st.badge}`}>{st.label}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className={`font-mono text-5xl font-bold tracking-tight tabular ${st.text}`}>{r && !stale ? formatReading(k, r) : '—'}</span>
        <span className="text-sm font-medium text-slate-400">{meta.unit}</span>
      </div>
      <div className="mt-3 text-slate-400" style={{ color: st.line }}>
        <Sparkline data={hist} color={st.line} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
        <span className={`rounded-md px-1.5 py-0.5 font-semibold ${demo ? 'bg-amber-100 text-amber-800' : source === 'Live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{source}</span>
        <span className="truncate">{r ? `${r.source} · ${ago! < 2 ? 'just now' : `${ago}s ago`}` : 'No connected device provides this'}</span>
      </div>
    </article>
  )
}
