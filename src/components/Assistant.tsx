import { Button } from '@/components/ui/button'
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
import { ASSISTANT_LANGUAGES, normaliseAssistantRequest, type AssistantLanguage } from '@/lib/assistantLanguages'

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
      text: 'How can I help? Tell me what is happening, or ask about your readings.',
    },
  ])
  const [input, setInput] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const language = useApp((s) => s.assistantLanguage)
  const [active, setActive] = useState<{ guide: Guide; step: number } | null>(null)
  const locale = ASSISTANT_LANGUAGES.find(l => l.code === language) ?? ASSISTANT_LANGUAGES[0]
  const speech = useSpeech(locale.voice)
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
      push(respond(normaliseAssistantRequest(text, language), appStore.state), voiceOn || viaVoice)
    },
    [push, voiceOn, language],
  )

  // Emergency mode: once the alarm is active, switch to calm first-aid guidance, spoken aloud.
  useEffect(() => {
    if (alarmPhase !== 'active' || !alarmStart) return
    setVoiceOn(true)
    push(respond('what should I do', appStore.state), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmPhase, alarmStart])

  const runAction = (a: Action) => {
    if (a.kind === 'call') { if (appStore.state.alarm.demo) return; window.location.href = telHref(a.number) }
    else if (a.kind === 'start-sos') raiseAlarm({ type: 'sos', label: 'SOS from assistant', reading: 'requested by voice or chat' }, { demo: appStore.state.demoMode, immediate: true })
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
        <Button variant="secondary"
          onClick={() => set({ assistantOpen: true })} className="assistant-launch fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-border bg-secondary py-3 px-4 font-semibold text-foreground shadow-sm shadow-surface-shadow/30 transition hover:-translate-y-0.5"
        >
          <Sparkles className="size-5 text-primary" /> First aid
        </Button>
      )}
      {open && alarmPhase !== 'countdown' && (
        <section
          aria-label="Lifeline assistant"
          className={`assistant-panel fixed inset-x-2 bottom-2 z-50 flex flex-col ${alarmPhase !== 'idle' ? 'max-h-[46dvh] sm:h-[min(720px,calc(100dvh-1rem))]' : 'h-[min(720px,calc(100dvh-1rem))]'} overflow-hidden rounded-lg border bg-card shadow-sm sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px] ${alarmPhase !== 'idle' ? 'border-destructive ring-4 ring-destructive/30' : 'border-border'}`}
        >
          <header className={`flex items-center gap-2 px-4 py-3 ${alarmPhase !== 'idle' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-foreground'}`}>
            <HeartPulse className="size-5" />
            <div className="mr-auto leading-tight">
              <p className="font-display font-bold">{alarmPhase !== 'idle' ? 'Emergency guidance' : 'Lifeline assistant'}</p>
              <p className="text-[11px] opacity-75">On-device guidance · not generative AI</p>
            </div>
            <Button variant="ghost"
              onClick={() => (voiceOn ? (speech.stopSpeaking(), setVoiceOn(false)) : setVoiceOn(true))}
              disabled={!speech.supported.tts}
              title={voiceOn ? 'Voice replies on' : 'Voice replies off'}
              className="grid size-9 place-items-center rounded-full hover:bg-card/15 disabled:opacity-40"
            >
              {voiceOn ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
            </Button>
            <Button variant="ghost" onClick={() => set({ assistantOpen: false })} className="grid size-9 place-items-center rounded-full hover:bg-card/15" aria-label="Close assistant">
              <X className="size-4.5" />
            </Button>
          </header>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <label htmlFor="assistant-language" className="text-xs text-muted-foreground">Input language</label>
            <select id="assistant-language" value={language} onChange={(e) => { speech.stopSpeaking(); speech.stopListening(); set({ assistantLanguage: e.target.value as AssistantLanguage }) }} className="min-h-11 rounded-md border border-border px-2 text-sm">
              {ASSISTANT_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">Guidance in English</span>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
            {msgs.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} dir="auto" className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-md bg-secondary px-3.5 py-2 text-sm text-foreground">{m.text}</p>
              ) : (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <p className="w-fit whitespace-pre-line rounded-lg rounded-bl-md bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm ring-1 ring-border">{m.text}</p>
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

          <div className="border-t border-border bg-card px-3 pb-3 pt-2">
            <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {QUICK_CHIPS.map((c) => (
                <Button variant="outline" key={c} onClick={() => ask(c)} className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-border">
                  {c}
                </Button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
              className="flex items-center gap-2"
            >
              <Button variant="ghost"
                type="button"
                disabled={!speech.supported.stt}
                onClick={() => (speech.listening ? speech.stopListening() : speech.listen((t) => ask(t, true)))}
                title={speech.supported.stt ? 'Speak' : 'Voice input is not supported in this browser'}
                className={`grid size-11 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${speech.listening ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-foreground hover:bg-muted'}`}
              >
                {speech.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </Button>
              <input
                dir={locale.direction}
                value={speech.listening ? speech.interim || 'Listening…' : input}
                onChange={(e) => setInput(e.target.value)}
                aria-label="Message the first-aid assistant" placeholder='Describe what is happening…'
                className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm outline-none focus:ring-2 focus:ring-border"
              />
              <Button variant="ghost" type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground" aria-label="Send">
                <Send className="size-4.5" />
              </Button>
            </form>
            {speech.error && <p role="alert" className="mt-2 text-xs text-critical">{speech.error}</p>}
            <p className="mt-2 text-center text-xs leading-snug text-muted-foreground">
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
  if (a.kind === 'call') return <Button variant="ghost" onClick={() => onRun(a)} className={`${base} bg-destructive text-destructive-foreground hover:bg-destructive`}><Phone className="size-3.5" />{a.label}</Button>
  if (a.kind === 'start-sos') return <Button variant="ghost" onClick={() => onRun(a)} className={`${base} bg-critical-soft text-critical ring-1 ring-destructive hover:bg-critical-soft`}><Siren className="size-3.5" />Yes, start SOS</Button>
  if (a.kind === 'open-guide') return <Button variant="ghost" onClick={() => onRun(a)} className={`${base} bg-card text-foreground ring-1 ring-border hover:ring-border`}>{guideById(a.id)?.title}</Button>
  if (a.kind === 'start-location') return <Button variant="ghost" onClick={() => onRun(a)} className={`${base} bg-accent text-primary`}><MapPin className="size-3.5" />Turn on location</Button>
  return <Button variant="ghost" onClick={() => onRun(a)} className={`${base} bg-accent text-primary`}><Share2 className="size-3.5" />Share location</Button>
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
    <div className="overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <p className="mr-auto font-display text-sm font-bold">{guide.title}</p>
        {guide.call === 'always' && <span className="rounded-full bg-critical-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal text-critical">Call now</span>}
      </div>
      <ol className="space-y-1 px-2 py-2">
        {guide.steps.map((s, i) => (
          <li key={i}>
            <Button variant="ghost"
              onClick={() => go(i)}
              className={`flex w-full gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition ${i === step ? 'bg-critical-soft text-foreground ring-1 ring-destructive' : i < step ? 'text-muted-foreground' : 'text-muted-foreground hover:bg-background'}`}
            >
              <span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === step ? 'bg-destructive text-destructive-foreground' : 'bg-muted'}`}>{i + 1}</span>
              {s}
            </Button>
          </li>
        ))}
      </ol>
      {guide.avoid && (
        <div className="mx-3 mb-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          {guide.avoid.map((a) => <p key={a}>⚠ {a}</p>)}
        </div>
      )}
      <div className="flex items-center gap-1.5 border-t border-border bg-background px-2.5 py-2">
        <Button variant="ghost" onClick={() => go(Math.max(0, step - 1))} className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Previous step"><ChevronLeft className="size-4.5" /></Button>
        {playing ? (
          <Button variant="ghost" onClick={() => { setPlaying(false); playingRef.current = false; gen.current++; speech.stopSpeaking(); speech.stopListening() }} className="flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-xs font-bold text-foreground">
            <Square className="size-3.5" /> {speech.listening ? 'Listening… say "next"' : 'Stop'}
          </Button>
        ) : (
          <Button disabled={!speech.supported.tts} onClick={() => { setPlaying(true); playingRef.current = true; say(step) }} className="flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-40">
            <Play className="size-3.5" /> Read aloud
          </Button>
        )}
        <Button variant="ghost" onClick={() => go(step)} className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Repeat step"><RotateCcw className="size-4" /></Button>
        <Button variant="ghost" onClick={() => go(Math.min(total - 1, step + 1))} className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label="Next step"><ChevronRight className="size-4.5" /></Button>
        {guide.metronome && (
          <Button variant="ghost" onClick={() => setBeat((b) => !b)} className={`ml-auto rounded-full px-3 py-2 text-xs font-bold ${beat ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-card ring-1 ring-border'}`}>
            {beat ? 'Beat on · 110/min' : 'CPR beat'}
          </Button>
        )}
      </div>
    </div>
  )
}
