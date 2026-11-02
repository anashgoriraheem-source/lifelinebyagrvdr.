import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Copy,
  Languages,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";
import { WORLD_LANGUAGES, languageInfo } from "@/i18n/worldLanguages";
import { useSpeech } from "@/hooks/useSpeech";
import {
  translateText,
  translationLanguages,
  translationStatus,
  type TranslationReply,
} from "@/lib/translate.functions";

export const Route = createFileRoute("/translate")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Translate · Lifeline" },
      {
        name: "description",
        content:
          "Translate text between the languages offered by the configured translation service.",
      },
      { property: "og:title", content: "Translate · Lifeline" },
      {
        property: "og:description",
        content:
          "Translate text between the languages offered by the configured translation service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TranslatePage,
});

/** A local script hint only — the provider performs real detection. */
function scriptHint(text: string): string | null {
  if (!text.trim()) return null;
  if (/[\u0600-\u06ff]/.test(text)) return "ur";
  if (/[\u0980-\u09ff]/.test(text)) return "bn";
  if (/[\u0a00-\u0a7f]/.test(text)) return "pa";
  if (/[\u0a80-\u0aff]/.test(text)) return "gu";
  if (/[\u0b80-\u0bff]/.test(text)) return "ta";
  if (/[\u0c00-\u0c7f]/.test(text)) return "te";
  if (/[\u0c80-\u0cff]/.test(text)) return "kn";
  if (/[\u0d00-\u0d7f]/.test(text)) return "ml";
  if (/[\u0b00-\u0b7f]/.test(text)) return "or";
  if (/[\u0900-\u097f]/.test(text)) return "hi";
  return "en";
}

interface Catalog {
  status: "ok" | "unavailable" | "unverified" | "error";
  provider: string | null;
  note?: string;
  languages: {
    code: string;
    name: string;
    englishName: string;
    nativeName: string;
    dir: "ltr" | "rtl";
    interfaceLocale: boolean;
  }[];
}

function TranslatePage() {
  const { t, locale } = useI18n();
  const [source, setSource] = useState<string>("auto");
  const [target, setTarget] = useState<string>(locale === "en" ? "hi" : locale);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationReply | null>(null);
  const [phase, setPhase] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [copied, setCopied] = useState(false);
  const run = useServerFn(translateText);
  const statusFn = useServerFn(translationStatus);
  const catalogFn = useServerFn(translationLanguages);
  const targetLanguage = languageInfo(target);
  const sourceLanguage = source === "auto" ? null : languageInfo(source);
  const speech = useSpeech(targetLanguage.tag);

  const worldOnly = WORLD_LANGUAGES.filter((w) => !LOCALES.some((l) => l.code === w.code));

  useEffect(() => {
    setTarget(locale === "en" ? "hi" : locale);
  }, [locale]);
  useEffect(() => {
    let active = true;
    statusFn()
      .then((s) => {
        if (active) setConfigured(s.configured);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    catalogFn()
      .then((c) => {
        if (active) setCatalog(c as Catalog);
      })
      .catch(() => {
        if (active) setCatalog(null);
      });
    return () => {
      active = false;
    };
  }, [statusFn, catalogFn]);

  const hint = useMemo(() => scriptHint(text), [text]);
  const tooLong = text.length > 5000;

  const translate = async () => {
    if (!text.trim() || tooLong) {
      setError(t("translate.empty"));
      return;
    }
    setPhase("working");
    setError(null);
    setResult(null);
    try {
      const reply = await run({ data: { text, source, target } });
      setResult(reply);
      if (reply.status !== "ok")
        setError(
          reply.error ??
            (reply.status === "unavailable" ? t("translate.unavailable") : t("translate.failed")),
        );
      setPhase(reply.status === "ok" ? "idle" : "error");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : t("translate.failed"));
    }
  };

  const copy = async () => {
    if (!result?.translatedText) return;
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const select =
    "min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground";

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6">
      <div className="flex items-center gap-3">
        <Languages className="size-7 text-primary" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("translate.title")}</h1>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {t("translate.subtitle")}
      </p>

      {configured === false && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-warning bg-warning-soft p-4 text-sm leading-relaxed"
        >
          <p className="font-semibold">{t("translate.unavailable")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Server configuration required: <code>TRANSLATE_API_URL</code> (and{" "}
            <code>TRANSLATE_API_KEY</code> if your service needs one), or <code>AI_API_KEY</code>{" "}
            with <code>AI_BASE_URL</code>/<code>AI_MODEL</code> for the model adapter.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="block text-sm">
          {t("translate.from")}
          <select
            className={`${select} mt-2`}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setResult(null);
            }}
          >
            <option value="auto">{t("translate.detect")}</option>
            <optgroup label={t("translate.interfacePack")}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} · {l.englishName}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("translate.translateOnly")}>
              {worldOnly.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} · {l.englishName}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          className="mb-0.5 h-11 w-11 px-0"
          aria-label="Swap source and target languages"
          disabled={source === "auto"}
          onClick={() => {
            const nextSource = target;
            setSource(nextSource);
            setTarget(source);
            setResult(null);
          }}
        >
          <ArrowRightLeft className="size-4" aria-hidden="true" />
        </Button>
        <label className="block text-sm">
          {t("translate.to")}
          <select
            className={`${select} mt-2`}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setResult(null);
            }}
          >
            <optgroup label={t("translate.interfacePack")}>
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} · {l.englishName}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("translate.translateOnly")}>
              {worldOnly.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} · {l.englishName}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-sm" htmlFor="translate-input">
            {t("translate.input")}
            {source === "auto" && hint && (
              <span className="ms-2 text-xs text-muted-foreground">
                ({t("translate.auto")}: {languageInfo(hint).englishName} — script hint only)
              </span>
            )}
          </label>
          <textarea
            id="translate-input"
            dir="auto"
            lang={sourceLanguage?.tag}
            value={text}
            maxLength={5200}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setError(null);
            }}
            rows={9}
            className="mt-2 w-full rounded-lg border border-border bg-card p-3 text-base text-foreground"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{text.length} / 5000</span>
            {tooLong && (
              <span className="text-critical">{t("translate.tooLong", { max: 5000 })}</span>
            )}
          </div>
          <Button
            type="button"
            className="mt-2 w-full"
            onClick={() => void translate()}
            disabled={phase === "working" || !text.trim() || tooLong}
          >
            {phase === "working" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t("common.loading")}
              </>
            ) : (
              t("translate.action")
            )}
          </Button>
        </div>

        <div>
          <p className="text-sm">{t("translate.output")}</p>
          <div
            dir={targetLanguage.dir}
            lang={targetLanguage.tag}
            aria-live="polite"
            aria-busy={phase === "working"}
            className="mt-2 min-h-[13.25rem] whitespace-pre-wrap rounded-lg border border-border bg-background/60 p-3 text-base leading-relaxed"
          >
            {result?.status === "ok" && result.translatedText}
            {phase === "working" && (
              <span className="text-muted-foreground">{t("common.loading")}</span>
            )}
            {!result && phase !== "working" && (
              <span className="text-muted-foreground">{t("translate.empty")}</span>
            )}
          </div>
          {result?.status === "ok" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("translate.machine")} · {result.provider}
                {result.resolvedSource &&
                  ` · ${t("translate.detected")}: ${languageInfo(result.resolvedSource).englishName}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copy()}>
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {copied ? t("common.copied") : t("translate.copy")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!speech.supported.tts}
                  title={speech.supported.tts ? undefined : t("chat.voiceUnavailable")}
                  onClick={() =>
                    result.translatedText &&
                    speech.speak(result.translatedText, undefined, { lang: targetLanguage.tag })
                  }
                >
                  <Volume2 className="size-4" aria-hidden="true" /> {t("translate.listen")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!speech.supported.tts}
                  onClick={() =>
                    result.translatedText &&
                    speech.speak(result.translatedText, undefined, { lang: targetLanguage.tag })
                  }
                >
                  <RotateCcw className="size-4" aria-hidden="true" /> {t("translate.replay")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!speech.speaking}
                  onClick={speech.paused ? speech.resumeSpeaking : speech.pauseSpeaking}
                >
                  {speech.paused ? (
                    <Play className="size-4" aria-hidden="true" />
                  ) : (
                    <Pause className="size-4" aria-hidden="true" />
                  )}
                  {speech.paused ? t("voice.resume") : t("voice.pause")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!speech.speaking}
                  onClick={speech.stopSpeaking}
                >
                  <Square className="size-4" aria-hidden="true" /> {t("translate.stop")}
                </Button>
              </div>
              {!speech.supported.tts && (
                <p className="text-xs text-muted-foreground">{t("chat.voiceUnavailable")}</p>
              )}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-critical bg-critical-soft p-3 text-sm"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold">{t("translate.providerTitle")}</h2>
        {catalog?.status === "ok" ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {catalog.provider} · {catalog.note}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {catalog.languages.map((l) => (
                <li
                  key={l.code}
                  className="rounded-lg border border-border bg-background/50 px-2 py-1 text-xs"
                  lang={l.code}
                  dir={l.dir}
                >
                  {l.nativeName}{" "}
                  <span className="text-muted-foreground">
                    · {l.englishName}
                    {l.interfaceLocale ? ` · ${t("translate.interfacePack")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p role="status" className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {catalog?.status === "unverified"
              ? t("translate.providerModel")
              : catalog?.note ?? t("translate.providerNone")}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("lang.safetyUnreviewed")} {t("safety.notMedicalDevice")}
        </p>
      </section>
    </main>
  );
}
