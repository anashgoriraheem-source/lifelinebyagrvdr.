import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, HeartPulse, Mic, MicOff, Phone, RotateCcw, Send, Sparkles, Square, Volume2, VolumeX, X, Play, Siren, MapPin, Share2 } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useSpeech } from '@/hooks/useSpeech'
import { QUICK_CHIPS, guideReply, respond, type Action, type Reply } from '@/lib/assistant'
import { guideById, type Guide } from '@/lib/firstAid'
import { appStore, raiseAlarm, set } from '@/lib/store'
import { startTracking } from '@/lib/location'
import { mapsLink, telHref } from '@/lib/sos'
import { tick } from '@/lib/siren'

interface Msg extends Reply {
  id: number
  role: 'user' | 'assistant'
}

let seq = 0

export function Assistant() {
  const open = useApp((s) => s.assistantOpen)
  const alarmPhase = useApp((s) => s.alarm.phase)
  const alarmStart = useApp((s) => s.alarm.startedAt)
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: seq++,
      role: 'assistant',
      text: 'Hi, I\'m your Lifeline assistant. Ask for first-aid steps ("someone is choking"), your status or location, or say "SOS". Tap the mic to talk.',
    },
  ])
  const [input, setInput] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const [active, setActive] = useState<{ guide: Guide; step: number } | null>(null)
  const speech = useSpeech()
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, open])

  const push = useCallback(
    (reply: Reply, speakIt: boolean) => {
      setMsgs((m) => [...m, { ...reply, id: seq++, role: 'assistant' }])
      if (reply.guide) setActive({ guide: reply.guide, step: 0 })
      if (speakIt) speech.speak(reply.text)
    },
    [speech],
  )

  const ask = useCallback(
    (text: string, viaVoice = false) => {
      if (!text.trim()) return
      setMsgs((m) => [...m, { id: seq++, role: 'user', text }])
      setInput('')
      push(respond(text, appStore.state), voiceOn || viaVoice)
    },
    [push, voiceOn],
  )

  // Emergency mode: once help is being called, switch to calm first-aid guidance, spoken aloud.
  useEffect(() => {
    if (alarmPhase !== 'dispatched' || !alarmStart) return
    setVoiceOn(true)
    push(respond('what should I do', appStore.state), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmPhase, alarmStart])

  const runAction = (a: Action) => {
    if (a.kind === 'call') window.location.href = telHref(a.number)
    else if (a.kind === 'start-sos') raiseAlarm({ type: 'sos', label: 'SOS from assistant', reading: 'requested by voice or chat' }, { demo: false, immediate: true })
    else if (a.kind === 'open-guide') {
      const g = guideById(a.id)
      if (!g) return
      setMsgs((m) => [...m, { id: seq++, role: 'user', text: g.title }])
      push(guideReply(g, appStore.state), voiceOn)
    } else if (a.kind === 'start-location') {
      startTracking()
      push({ text: 'Turning on location tracking. Your browser may ask for permission.' }, false)
    } else if (a.kind === 'share-location') {
      const f = appStore.state.location.fix
      if (f) void navigator.share?.({ title: 'My location', url: mapsLink(f) }).catch(() => {})
    }
  }

  return (
    <>
      {!open && alarmPhase !== 'countdown' && (
        <button
          onClick={() => set({ assistantOpen: true })}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-slate-900 py-3 pl-4 pr-5 font-semibold text-white shadow-2xl shadow-slate-900/30 transition hover:-translate-y-0.5"
        >
          <Sparkles className="size-5 text-rose-400" /> First-aid assistant
        </button>
      )}
      {open && alarmPhase !== 'countdown' && (
        <section
          aria-label="Lifeline assistant"
          className={`fixed inset-x-2 bottom-2 z-50 flex flex-col ${alarmPhase !== 'idle' ? 'max-h-[46dvh] sm:max-h-[min(720px,calc(100dvh-1rem))]' : 'max-h-[min(720px,calc(100dvh-1rem))]'} overflow-hidden rounded-3xl border bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px] ${alarmPhase !== 'idle' ? 'border-rose-300 ring-4 ring-rose-500/30' : 'border-slate-200'}`}
        >
          <header className={`flex items-center gap-2 px-4 py-3 ${alarmPhase !== 'idle' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
            <HeartPulse className="size-5" />
            <div className="mr-auto leading-tight">
              <p className="font-display font-bold">{alarmPhase !== 'idle' ? 'Emergency guidance' : 'Lifeline assistant'}</p>
              <p className="text-[11px] opacity-75">Works offline · voice guided</p>
            </div>
            <button
              onClick={() => (voiceOn ? (speech.stopSpeaking(), setVoiceOn(false)) : setVoiceOn(true))}
              disabled={!speech.supported.tts}
              title={voiceOn ? 'Voice replies on' : 'Voice replies off'}
              className="grid size-9 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"
            >
              {voiceOn ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
            </button>
            <button onClick={() => set({ assistantOpen: false })} className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Close assistant">
              <X className="size-4.5" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {msgs.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-sm text-white">{m.text}</p>
              ) : (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <p className="w-fit whitespace-pre-line rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200">{m.text}</p>
                  {m.guide && active?.guide.id === m.guide.id && m.id === lastGuideMsg(msgs) && (
                    <GuidePlayer guide={active.guide} step={active.step} setStep={(step) => setActive({ guide: active.guide, step })} speech={speech} />
                  )}
                  {m.actions && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a, i) => (
                        <ActionChip key={i} a={a} onRun={runAction} />
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2">
            <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {QUICK_CHIPS.map((c) => (
                <button key={c} onClick={() => ask(c)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400">
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                disabled={!speech.supported.stt}
                onClick={() => (speech.listening ? speech.stopListening() : speech.listen((t) => ask(t, true)))}
                title={speech.supported.stt ? 'Speak' : 'Voice input is not supported in this browser'}
                className={`grid size-11 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${speech.listening ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {speech.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>
              <input
                value={speech.listening ? speech.interim || 'Listening…' : input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "someone is choking"'
                className="h-11 min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-900 text-white" aria-label="Send">
                <Send className="size-4.5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10.5px] leading-snug text-slate-500">
              Not a doctor or a medical device. In an emergency, always call your local emergency number.
            </p>
          </div>
        </section>
      )}
    </>
  )
}

const lastGuideMsg = (msgs: Msg[]) => [...msgs].reverse().find((m) => m.guide)?.id

function ActionChip({ a, onRun }: { a: Action; onRun: (a: Action) => void }) {
  const base = 'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition'
  if (a.kind === 'call') return <button onClick={() => onRun(a)} className={`${base} bg-rose-600 text-white hover:bg-rose-700`}><Phone className="size-3.5" />{a.label}</button>
  if (a.kind === 'start-sos') return <button onClick={() => onRun(a)} className={`${base} bg-rose-100 text-rose-800 ring-1 ring-rose-300 hover:bg-rose-200`}><Siren className="size-3.5" />Yes, start SOS</button>
  if (a.kind === 'open-guide') return <button onClick={() => onRun(a)} className={`${base} bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-slate-500`}>{guideById(a.id)?.title}</button>
  if (a.kind === 'start-location') return <button onClick={() => onRun(a)} className={`${base} bg-sky-100 text-sky-800`}><MapPin className="size-3.5" />Turn on location</button>
  return <button onClick={() => onRun(a)} className={`${base} bg-sky-100 text-sky-800`}><Share2 className="size-3.5" />Share location</button>
}

const COMMANDS = { next: /\b(next|done|okay|ok|continue)\b/, back: /\b(back|previous)\b/, repeat: /\b(repeat|again|what)\b/, stop: /\b(stop|pause|quiet)\b/ }

/** Step-by-step spoken guide. Hands-free: after each step it listens for "next", "repeat", "back" or "stop". */
function GuidePlayer({ guide, step, setStep, speech }: { guide: Guide; step: number; setStep: (n: number) => void; speech: ReturnType<typeof useSpeech> }) {
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(false)
  const stepRef = useRef(step)
  stepRef.current = step
  const gen = useRef(0)
  const playingRef = useRef(false)
  playingRef.current = playing
  const total = guide.steps.length

  const say = useCallback(
    (i: number) => {
      setStep(i)
      const my = ++gen.current
      const text = `Step ${i + 1} of ${total}. ${guide.steps[i]}`
      speech.speak(text, () => {
        // Ignore ends caused by interruption, or after the user pressed Stop.
        if (my !== gen.current || !playingRef.current || !speech.supported.stt) return
        speech.listen((heard) => {
          const h = heard.toLowerCase()
          if (COMMANDS.stop.test(h)) return setPlaying(false)
          if (stepRef.current >= total - 1 && COMMANDS.next.test(h)) return setPlaying(false)
          if (COMMANDS.back.test(h)) return say(Math.max(0, stepRef.current - 1))
          if (COMMANDS.next.test(h) && stepRef.current < total - 1) return say(stepRef.current + 1)
          say(stepRef.current)
        })
      })
    },
    [guide, setStep, speech, total],
  )

  useEffect(() => {
    if (!beat) return
    const id = setInterval(tick, 60000 / 110)
    return () => clearInterval(id)
  }, [beat])

  useEffect(() => () => { speech.stopSpeaking(); speech.stopListening() }, [guide.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => (playing ? say(i) : setStep(i))

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <p className="mr-auto font-display text-sm font-bold">{guide.title}</p>
        {guide.call === 'always' && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">Call now</span>}
      </div>
      <ol className="space-y-1 px-2 py-2">
        {guide.steps.map((s, i) => (
          <li key={i}>
            <button
              onClick={() => go(i)}
              className={`flex w-full gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] leading-snug transition ${i === step ? 'bg-rose-50 text-slate-900 ring-1 ring-rose-200' : i < step ? 'text-slate-400' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === step ? 'bg-rose-600 text-white' : 'bg-slate-100'}`}>{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {guide.avoid && (
        <div className="mx-3 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {guide.avoid.map((a) => <p key={a}>⚠ {a}</p>)}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-2.5 py-2">
        <button onClick={() => go(Math.max(0, step - 1))} className="grid size-9 place-items-center rounded-full hover:bg-slate-200" aria-label="Previous step"><ChevronLeft className="size-4.5" /></button>
        {playing ? (
          <button onClick={() => { setPlaying(false); playingRef.current = false; gen.current++; speech.stopSpeaking(); speech.stopListening() }} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white">
            <Square className="size-3.5" /> {speech.listening ? 'Listening… say "next"' : 'Stop'}
          </button>
        ) : (
          <button disabled={!speech.supported.tts} onClick={() => { setPlaying(true); playingRef.current = true; say(step) }} className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-40">
            <Play className="size-3.5" /> Read aloud
          </button>
        )}
        <button onClick={() => go(step)} className="grid size-9 place-items-center rounded-full hover:bg-slate-200" aria-label="Repeat step"><RotateCcw className="size-4" /></button>
        <button onClick={() => go(Math.min(total - 1, step + 1))} className="grid size-9 place-items-center rounded-full hover:bg-slate-200" aria-label="Next step"><ChevronRight className="size-4.5" /></button>
        {guide.metronome && (
          <button onClick={() => setBeat((b) => !b)} className={`ml-auto rounded-full px-3 py-2 text-xs font-bold ${beat ? 'bg-rose-600 text-white animate-pulse' : 'bg-white ring-1 ring-slate-300'}`}>
            {beat ? 'Beat on · 110/min' : 'CPR beat'}
          </button>
        )}
      </div>
    </div>
  )
}
