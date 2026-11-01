import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { raiseAlarm } from '@/lib/store'

const HOLD_MS = 1200

/**
 * Press-and-hold SOS with haptic feedback, identical for pointer and keyboard.
 * Fires on completion — no countdown. In demo mode it raises a simulated alert
 * so real dialler/message actions are never opened from a demo.
 */
export function SosButton({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const demoMode = useApp((s) => s.demoMode)
  const [progress, setProgress] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef(0)
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current) }, [])

  const fire = () => {
    raf.current = null
    setProgress(0)
    navigator.vibrate?.([80, 40, 80])
    raiseAlarm({ type: 'sos', label: 'SOS pressed', reading: 'manual panic button' }, { demo: demoMode, immediate: true })
  }
  const begin = () => {
    if (raf.current) return
    navigator.vibrate?.(30)
    start.current = performance.now()
    const step = () => {
      const p = Math.min(1, (performance.now() - start.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) { fire(); return }
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    setProgress(0)
  }
  const pointer = (e: React.PointerEvent) => { e.preventDefault(); if (raf.current) return; e.currentTarget.setPointerCapture(e.pointerId); begin() }
  const keyboard = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin() }
  }

  const dim = size === 'lg' ? 'size-28' : 'size-16'
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <Button
      type="button"
      onPointerDown={pointer}
      onPointerUp={end}
      onLostPointerCapture={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={keyboard}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') end() }}
      onBlur={end}
      aria-label="SOS — press and hold to open emergency actions"
      variant="destructive"
      className={`relative h-auto p-0 ${dim} shrink-0 select-none touch-none rounded-full bg-destructive text-destructive-foreground shadow-sm shadow-surface-shadow/40 transition active:scale-95`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-destructive animate-ring" />
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth="4" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" />
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <span className={`font-display font-extrabold tracking-normal ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}>SOS</span>
        {size === 'lg' && <span className="mt-1 text-[10px] font-semibold uppercase tracking-normal opacity-80">Hold</span>}
      </span>
    </Button>
  )
}
