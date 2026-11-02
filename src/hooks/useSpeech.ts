import { useCallback, useEffect, useRef, useState } from "react";

/* Web Speech API typings are not in lib.dom for recognition. */
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => Recognition) | null;
}

export function useSpeech(lang = "en-IN") {
  const [supported, setSupported] = useState({ tts: false, stt: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported({ tts: "speechSynthesis" in window, stt: !!getRecognitionCtor() });
    const load = () => setVoices(window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    load();
    window.speechSynthesis?.addEventListener?.("voiceschanged", load);
    return () => {
      recRef.current?.stop();
      window.speechSynthesis?.removeEventListener?.("voiceschanged", load);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void, opts?: { lang?: string; voiceURI?: string }) => {
      if (!("speechSynthesis" in window)) return onEnd?.();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "map link"));
      const spokenLanguage =
        opts?.lang ??
        (/[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Gurmukhi}]/u.test(text)
          ? lang
          : "en-IN");
      u.lang = spokenLanguage;
      u.rate = 0.95;
      const all = window.speechSynthesis.getVoices();
      const voice =
        (opts?.voiceURI && all.find((v) => v.voiceURI === opts.voiceURI)) ||
        all.find((v) => v.lang === spokenLanguage) ||
        all.find((v) => v.lang.startsWith(spokenLanguage.split("-")[0])) ||
        all.find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        onEnd?.();
      };
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const pauseSpeaking = useCallback(() => {
    if (!window.speechSynthesis?.speaking) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (!window.speechSynthesis?.paused) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const listen = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      window.speechSynthesis?.cancel();
      recRef.current?.stop();
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e) => {
        let text = "";
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
          if (e.results[i].isFinal) final = true;
        }
        setInterim(text);
        if (final) {
          setInterim("");
          onFinal(text.trim());
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e) => {
        setListening(false);
        setError(
          e.error === "not-allowed"
            ? "Microphone access was denied. You can still type."
            : "Voice input failed. Try again or type your message.",
        );
      };
      recRef.current = rec;
      setListening(true);
      setError(null);
      try {
        rec.start();
      } catch {
        setListening(false);
        setError("Voice input could not start. Try again or type.");
      }
    },
    [lang],
  );

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return {
    supported,
    listening,
    speaking,
    paused,
    interim,
    error,
    voices,
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    listen,
    stopListening,
  };
}
