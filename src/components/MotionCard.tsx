import { Move3d } from 'lucide-react'
import { useMotion } from '@/hooks/useMotion'
import { addLog, raiseAlarm, set } from '@/lib/store'
import { useApp } from '@/hooks/useApp'

export function MotionCard() {
  const demo = useApp((s) => s.demoMode)
  const motion = useMotion((e) => {
    if (e.type === 'impact') addLog('info', `Impact ${(e.peak / 9.81).toFixed(1)} g · checking for movement`)
    if (e.type === 'recovered') addLog('info', 'Impact followed by movement · no alarm')
    if (e.type === 'fall') raiseAlarm({ type: 'fall', label: 'Fall detected', reading: `impact ${(e.peak / 9.81).toFixed(1)} g, then no movement` }, { demo })
    if (e.type === 'jolt') raiseAlarm({ type: 'jolt', label: 'Violent jolt', reading: `${(e.peak / 9.81).toFixed(1)} g spike` }, { demo })
  })
  const mag = motion.magnitude
  const pct = mag == null ? 0 : Math.min(100, (mag / (4 * 9.81)) * 100)

  return (
    <article className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-600"><Move3d className="size-4" /></span>
        <h3 className="mr-auto text-sm font-semibold text-slate-600">Fall & jolt sensor</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${motion.permission === 'granted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
          {motion.permission === 'granted' ? (motion.checking ? `Checking ${motion.checking}s` : 'Watching') : motion.permission === 'unsupported' ? 'No sensor' : motion.permission === 'denied' ? 'Blocked' : 'Needs access'}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-mono text-4xl font-bold tabular text-slate-900">{mag == null ? '—' : mag.toFixed(1)}</span>
        <span className="text-sm text-slate-400">m/s² · rest ≈ 9.8</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-violet-500 transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Detects free-fall → impact → 10 s of stillness, and violent jolts. Works while this page is open on your phone.
      </p>
      <div className="mt-4 flex gap-2">
        {motion.permission !== 'granted' && (
          <button onClick={motion.enable} disabled={motion.permission === 'unsupported'} className="rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40">
            Enable motion sensor
          </button>
        )}
        {demo && (
          <button onClick={() => set({ scenario: 'fall' })} className="rounded-full px-3.5 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300">
            Simulate fall
          </button>
        )}
      </div>
    </article>
  )
}
