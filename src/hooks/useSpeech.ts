import { useCallback, useEffect, useRef, useState } from 'react'

/* Web Speech API typings are not in lib.dom for recognition. */
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null
}

export function useSpeech(lang = 'en-IN') {
  const [supported, setSupported] = useState({ tts: false, stt: false })
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<Recognition | null>(null)

  useEffect(() => {
    setSupported({ tts: 'speechSynthesis' in window, stt: !!getRecognitionCtor() })
    return () => {
      recRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!('speechSynthesis' in window)) return onEnd?.()
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, 'map link'))
      u.lang = lang
      u.rate = 0.95
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang === lang) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('en'))
      if (voice) u.voice = voice
      u.onstart = () => setSpeaking(true)
      u.onend = () => {
        setSpeaking(false)
        onEnd?.()
      }
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    },
    [lang],
  )

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const listen = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return
      window.speechSynthesis?.cancel()
      recRef.current?.stop()
      const rec = new Ctor()
      rec.lang = lang
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (e) => {
        let text = ''
        let final = false
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript
          if (e.results[i].isFinal) final = true
        }
        setInterim(text)
        if (final) {
          setInterim('')
          onFinal(text.trim())
        }
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recRef.current = rec
      setListening(true)
      rec.start()
    },
    [lang],
  )

  const stopListening = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { supported, listening, speaking, interim, speak, stopSpeaking, listen, stopListening }
}
