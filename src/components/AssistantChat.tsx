import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  Pause,
  Phone,
  Play,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/hooks/useSpeech";
import { askAssistant, assistantStatus, type AssistantReply } from "@/lib/assistant.functions";
import type { AssistantAnswer, PersonalContext } from "@/lib/knowledge";
import { VITAL_META, formatReading, isStale } from "@/lib/detection";
import { emergencyNumbers } from "@/lib/store";
import { telHref } from "@/lib/sos";
import { AiComposer, type OutgoingImage } from "@/components/AiComposer";
import type { VitalKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type Message =
  | { id: number; role: "user"; text: string; imageName?: string }
  | { id: number; role: "assistant"; answer: AssistantAnswer };

let seq = 0;

const VITALS: VitalKey[] = ["bp", "glucose", "hr", "spo2"];

function useDeviceSnapshot(): PersonalContext {
  const profile = useApp((s) => s.profile);
  const contacts = useApp((s) => s.contacts);
  const vitals = useApp((s) => s.vitals);
  const log = useApp((s) => s.log);
  const signedIn = useApp((s) => Boolean(s.userId));
  const { formatDateTime } = useI18n();
  const now = Date.now();
  return {
    signedIn,
    name: profile.name || undefined,
    age: profile.age,
    bloodType: profile.bloodType,
    conditions: profile.conditions,
    allergies: profile.allergies,
    medications: profile.medications,
    contacts: contacts.map((c) => ({
      name: c.name,
      relationship: c.relationship,
      sms: c.sms,
      call: c.call,
      email: Boolean(c.email && c.emailAlerts),
      confirmed: Boolean(c.confirmedAt),
    })),
    readings: VITALS.flatMap((k) => {
      const r = vitals[k];
      if (!r) return [];
      return [
        {
          key: k,
          label: VITAL_META[k].label,
          value: formatReading(k, r),
          unit: VITAL_META[k].unit,
          source: r.source,
          measuredAt: r.measuredAt,
          quality: r.quality,
          stale: isStale(k, r, now),
        },
      ];
    }),
    incidents: log
      .filter((e) => e.kind === "alarm" || e.kind === "sos")
      .slice(0, 3)
      .map((e) => ({
        reason: e.text,
        status: "recorded on this device",
        startedAt: formatDateTime(e.at),
      })),
  };
}

function devicePayload(context: PersonalContext) {
  return {
    name: context.name,
    age: context.age,
    bloodType: context.bloodType,
    conditions: context.conditions,
    allergies: context.allergies,
    medications: context.medications,
    contacts: context.contacts,
    readings: context.readings.map((r) => ({
      ...r,
      key: r.key as "bp" | "glucose" | "hr" | "spo2",
    })),
    incidents: context.incidents,
  };
}

interface Props {
  variant?: "panel" | "inline";
  className?: string;
}

export function AssistantChat({ variant = "inline", className }: Props) {
  const { t, locale, tag, formatDateTime, locales } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [libraryOn, setLibraryOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [copied, setCopied] = useState<number | null>(null);
  const [status, setStatus] = useState<{
    modelConfigured: boolean;
    providerName: string | null;
  } | null>(null);
  const [answerLocale, setAnswerLocale] = useState(locale);
  const lastQuestion = useRef<{ text: string; image: OutgoingImage | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(askAssistant);
  const statusFn = useServerFn(assistantStatus);
  const snapshot = useDeviceSnapshot();
  const speech = useSpeech(tag);
  const emergency = useApp(emergencyNumbers);

  useEffect(() => {
    setAnswerLocale(locale);
  }, [locale]);
  useEffect(() => {
    let active = true;
    statusFn()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {
        if (active) setStatus({ modelConfigured: false, providerName: null });
      });
    return () => {
      active = false;
    };
  }, [statusFn]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, phase]);

  const speak = useCallback(
    (answer: AssistantAnswer) => {
      speech.speak(answer.text, undefined, {
        lang: answer.languageFallback ? "en-IN" : tag,
        voiceURI: voiceURI || undefined,
      });
    },
    [speech, tag, voiceURI],
  );

  const send = useCallback(
    async (question: string, image: OutgoingImage | null) => {
      lastQuestion.current = { text: question, image };
      setMessages((m) => [
        ...m,
        { id: seq++, role: "user", text: question, imageName: image?.name },
      ]);
      setText("");
      setPhase("thinking");
      setError(null);
      try {
        const history = messages
          .slice(-6)
          .map((m) => ({ role: m.role, text: m.role === "user" ? m.text : m.answer.text }));
        const reply: AssistantReply = await ask({
          data: {
            question,
            locale,
            answerLocale,
            useLibrary: libraryOn,
            imageName: image?.name,
            imageDataUrl: image?.dataUrl,
            history,
            device: devicePayload(snapshot),
          },
        });
        setMessages((m) => [...m, { id: seq++, role: "assistant", answer: reply.answer }]);
        setStatus(
          (s) => s ?? { modelConfigured: reply.modelConfigured, providerName: reply.providerName },
        );
        setPhase("idle");
        if (voiceOn) speak(reply.answer);
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : t("common.error"));
      }
    },
    [ask, messages, locale, answerLocale, libraryOn, snapshot, voiceOn, speak, t],
  );

  const editLast = () => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (last && last.role === "user") setText(last.text);
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hasUserMessages = messages.some((m) => m.role === "user");
  const voices = speech.voices.filter((v) =>
    v.lang.toLowerCase().startsWith(tag.split("-")[0].toLowerCase()),
  );

  const suggestions =
    locale === "en"
      ? [
          "What do my latest readings say, and when were they measured?",
          "Who will be contacted if I press SOS, and on which channels?",
          "What is the first aid for severe bleeding?",
        ]
      : [];

  return (
    <section
      aria-label={t("chat.title")}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card",
        variant === "panel" ? "h-full" : "",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-secondary px-4 py-3">
        <span
          className="grid size-9 place-items-center rounded-lg border border-border text-primary"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="me-auto min-w-0">
          <h2 className="font-display text-base font-bold leading-tight">{t("chat.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">{t("chat.languageOverride")}</span>
          <select
            value={answerLocale}
            onChange={(e) => setAnswerLocale(e.target.value as typeof locale)}
            className="min-h-11 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
          >
            {locales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="lc-action"
          aria-label={voiceOn ? t("chat.voiceStop") : t("chat.voiceStart")}
          aria-pressed={voiceOn}
          onClick={() => {
            if (voiceOn) speech.stopSpeaking();
            setVoiceOn(!voiceOn);
          }}
        >
          {voiceOn ? (
            <Volume2 className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
        </button>
      </header>

      {voiceOn && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {!speech.supported.tts ? (
            <p role="status">{t("chat.voiceUnavailable")}</p>
          ) : voices.length > 1 ? (
            <label className="flex items-center gap-2">
              Voice
              <select
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                className="min-h-11 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
              >
                <option value="">Device default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              {voices.length === 1
                ? `Using ${voices[0].name} (${voices[0].lang})`
                : t("chat.voiceUnavailable")}
            </p>
          )}
          {speech.speaking && (
            <button
              type="button"
              onClick={speech.stopSpeaking}
              className="ms-auto flex min-h-11 items-center gap-1 rounded-lg px-2 text-foreground"
            >
              <Square className="size-3.5" aria-hidden="true" /> {t("chat.voiceStop")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              speech.stopSpeaking();
              setVoiceOn(false);
            }}
            className={`flex min-h-11 items-center gap-1 rounded-lg px-2 text-foreground ${
              speech.speaking ? "" : "ms-auto"
            }`}
          >
            {t("voice.textOnly")}
          </button>
        </div>
      )}

      {status && !status.modelConfigured && (
        <p
          role="status"
          className="border-b border-border bg-secondary/60 px-4 py-2 text-xs leading-relaxed text-muted-foreground"
        >
          {t("chat.unavailable")}
        </p>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4",
          variant === "inline" && "max-h-[30rem]",
        )}
        aria-live="polite"
        aria-busy={phase === "thinking"}
      >
        {!hasUserMessages && (
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-sm font-medium">{t("chat.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.signedIn ? t("chat.subtitle") : t("chat.signedOut")}
            </p>
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s, null)}
                    className="min-h-11 rounded-lg border border-border px-3 py-2 text-start text-xs text-foreground transition hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              dir="auto"
              className="ms-auto w-fit max-w-[85%] rounded-xl rounded-ee-sm bg-secondary px-3.5 py-2.5 text-sm text-foreground"
            >
              {m.text}
              {m.imageName && (
                <p className="mt-1 text-[11px] text-muted-foreground">🖼 {m.imageName}</p>
              )}
            </div>
          ) : (
            <AssistantBubble
              key={m.id}
              answer={m.answer}
              formatDateTime={formatDateTime}
              copied={copied === m.id}
              onCopy={() => {
                void navigator.clipboard
                  ?.writeText(m.answer.text)
                  .then(() => {
                    setCopied(m.id);
                    setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 2000);
                  })
                  .catch(() => {});
              }}
              onSpeak={() => speak(m.answer)}
              onStop={speech.stopSpeaking}
              onPause={speech.pauseSpeaking}
              onResume={speech.resumeSpeaking}
              speaking={speech.speaking}
              paused={speech.paused}
              emergencyNumber={emergency.general}
              labels={{
                sources: t("chat.sources"),
                escalateTitle: t("chat.escalationTitle"),
                escalateBody: t("chat.escalationBody"),
                call: t("safety.callEmergency"),
                copy: t("common.copy"),
                copied: t("common.copied"),
                groundedIn: t("chat.groundedIn"),
                recordProfile: t("chat.recordProfile"),
                recordContacts: t("chat.recordContacts"),
                recordReadings: t("chat.recordReadings"),
                recordIncidents: t("chat.recordIncidents"),
                limitationFallback: t("chat.unavailable"),
                voiceStart: t("chat.voiceStart"),
                voiceStop: t("chat.voiceStop"),
                pause: t("voice.pause"),
                resume: t("voice.resume"),
                replay: t("voice.replay"),
              }}
            />
          ),
        )}

        {phase === "thinking" && (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("chat.thinking")}
          </div>
        )}
        {phase === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-critical bg-critical-soft p-3 text-sm"
          >
            <p>{error}</p>
            {lastQuestion.current && (
              <button
                type="button"
                onClick={() => void send(lastQuestion.current!.text, lastQuestion.current!.image)}
                className="mt-2 min-h-11 rounded-lg border border-border px-3 text-sm"
              >
                {t("common.retry")}
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border px-3 pb-3 pt-3">
        <AiComposer
          value={text}
          onValueChange={setText}
          onSend={(value, image) => void send(value, image)}
          onEditLast={editLast}
          canEditLast={Boolean(lastUser)}
          libraryOn={libraryOn}
          onToggleLibrary={() => setLibraryOn((v) => !v)}
          busy={phase === "thinking"}
          placeholder={t("chat.placeholder")}
          className="mx-auto"
        />
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          {t("chat.disclaimer")}
        </p>
      </div>
    </section>
  );
}

function AssistantBubble({
  answer,
  formatDateTime,
  copied,
  onCopy,
  onSpeak,
  onStop,
  onPause,
  onResume,
  speaking,
  paused,
  emergencyNumber,
  labels,
}: {
  answer: AssistantAnswer;
  formatDateTime: (v: string | number | Date) => string;
  copied: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  speaking: boolean;
  paused: boolean;
  emergencyNumber: string;
  labels: Record<string, string>;
}) {
  return (
    <div className="max-w-[92%] space-y-2">
      {answer.escalate && (
        <div role="alert" className="rounded-lg border border-critical bg-critical-soft p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-critical">
            <AlertTriangle className="size-4" aria-hidden="true" /> {labels.escalateTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{labels.escalateBody}</p>
          <a
            href={telHref(emergencyNumber)}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-critical px-3 text-sm font-bold text-destructive-foreground"
          >
            <Phone className="size-4" aria-hidden="true" /> {labels.call} · {emergencyNumber}
          </a>
        </div>
      )}

      <div
        dir="auto"
        className="whitespace-pre-line rounded-xl rounded-es-sm bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground ring-1 ring-border"
      >
        {answer.text}
      </div>

      {answer.limitation && (
        <p className="rounded-lg border border-border bg-secondary/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
          {answer.limitation}
        </p>
      )}

      {answer.groundedIn.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {labels.groundedIn}:{" "}
          {answer.groundedIn
            .map(
              (g) =>
                labels[
                  g === "profile"
                    ? "recordProfile"
                    : g === "contacts"
                      ? "recordContacts"
                      : g === "readings"
                        ? "recordReadings"
                        : "recordIncidents"
                ],
            )
            .join(" · ")}
        </p>
      )}

      {answer.sources.length > 0 && (
        <details className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground">
            {labels.sources} ({answer.sources.length})
          </summary>
          <ul className="space-y-2 pb-1">
            {answer.sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1 text-primary underline-offset-2 hover:underline"
                >
                  {s.title} <ArrowUpRight className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                </a>
                <p className="text-muted-foreground">
                  {s.publisher} · {s.jurisdiction} ·{" "}
                  {s.reviewed
                    ? `reviewed ${formatDateTime(s.reviewed)}`
                    : "review date not recorded"}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onCopy}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? labels.copied : labels.copy}
        </button>
        <button
          type="button"
          onClick={onSpeak}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Volume2 className="size-3.5" aria-hidden="true" /> {labels.replay}
        </button>
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          disabled={!speaking}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label={paused ? labels.resume : labels.pause}
        >
          {paused ? (
            <Play className="size-3.5" aria-hidden="true" />
          ) : (
            <Pause className="size-3.5" aria-hidden="true" />
          )}
          {paused ? labels.resume : labels.pause}
        </button>
        <button
          type="button"
          onClick={onStop}
          className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Square className="size-3.5" aria-hidden="true" /> {labels.voiceStop}
        </button>
      </div>
    </div>
  );
}
