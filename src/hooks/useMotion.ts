import { useCallback, useEffect, useRef, useState } from 'react'
import { createFallDetector, type FallEvent, type Sensitivity } from '@/lib/fallDetection'

type MotionPermission = 'unknown' | 'granted' | 'denied' | 'unsupported'

/** Phone accelerometer + fall detector. Calls onEvent for impact/fall/jolt events. */
export function useMotion(onEvent: (e: FallEvent) => void, sensitivity: Sensitivity = 'medium') {
  const [permission, setPermission] = useState<MotionPermission>('unknown')
  const [magnitude, setMagnitude] = useState<number | null>(null)
  const [checking, setChecking] = useState<number | null>(null)
  const cb = useRef(onEvent)
  cb.current = onEvent
  const wakeLock = useRef<{ release(): Promise<void> } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !('DeviceMotionEvent' in window)) setPermission('unsupported')
  }, [])

  useEffect(() => {
    if (permission !== 'granted') return
    const feed = createFallDetector(sensitivity)
    let lastUi = 0
    const handler = (ev: DeviceMotionEvent) => {
      const a = ev.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const mag = Math.hypot(a.x, a.y, a.z)
      const now = performance.now()
      if (now - lastUi > 120) {
        setMagnitude(mag)
        lastUi = now
      }
      const e = feed(mag, now)
      if (!e) return
      if (e.type === 'checking') setChecking(Math.ceil(e.remainingMs / 1000))
      else {
        setChecking(e.type === 'impact' ? 10 : null)
        cb.current(e)
      }
    }
    window.addEventListener('devicemotion', handler)
    // Keep the screen awake while monitoring.
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (wakeLock.current = l)).catch(() => {})
    return () => {
      window.removeEventListener('devicemotion', handler)
      void wakeLock.current?.release()
    }
  }, [permission, sensitivity])

  const enable = useCallback(async () => {
    const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> } | undefined
    if (!DM) return setPermission('unsupported')
    if (typeof DM.requestPermission === 'function') {
      try {
        setPermission((await DM.requestPermission()) === 'granted' ? 'granted' : 'denied')
      } catch {
        setPermission('denied')
      }
    } else setPermission('granted')
  }, [])

  return { permission, magnitude, checking, enable }
}
