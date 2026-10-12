/** Loud repeating two-tone alarm via Web Audio, plus vibration. */
let ctx: AudioContext | null = null
let timer: ReturnType<typeof setInterval> | null = null

function beep(freq: number, at: number, dur: number) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(ctx.destination)
  o.start(at)
  o.stop(at + dur + 0.05)
}

export function startSiren() {
  if (timer) return
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    return
  }
  const cycle = () => {
    if (!ctx) return
    const t = ctx.currentTime
    beep(960, t, 0.28)
    beep(720, t + 0.32, 0.28)
    navigator.vibrate?.([300, 100, 300])
  }
  cycle()
  timer = setInterval(cycle, 700)
}

export function stopSiren() {
  if (timer) clearInterval(timer)
  timer = null
  navigator.vibrate?.(0)
}

/** Short tick used by the CPR metronome. */
export function tick() {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    beep(1200, ctx.currentTime, 0.05)
  } catch {
    /* audio unavailable */
  }
}
