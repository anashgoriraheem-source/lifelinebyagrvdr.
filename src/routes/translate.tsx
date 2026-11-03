import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/hooks/useSpeech";
import { translationStatus, translateText, type TranslationReply } from "@/lib/translate.functions";
export const Route = createFileRoute("/translate")({ ssr: false, component: TranslatePage });
import { publicTranslationPhrases as phrases } from "@/lib/translationPolicy";

function TranslatePage() {
  const { t, locale } = useI18n();
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"en" | "hi">("hi");
  const [consent, setConsent] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TranslationReply | null>(null);
  const [failed, setFailed] = useState(false);
  const status = useServerFn(translationStatus);
  const run = useServerFn(translateText);
  const speech = useSpeech(target === "hi" ? "hi-IN" : "en-IN");
  useEffect(() => {
    let active = true;
    status()
      .then((r) => {
        if (active) setConfigured(r.configured);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => {
      active = false;
    };
  }, [status]);
  const submit = async () => {
    if (!consent || !text || busy) return;
    setBusy(true);
    setResult(null);
    setFailed(false);
    try {
      const response = await run({ data: { text, source: "auto", target, consent: true } });
      setResult(response);
      setFailed(response.status !== "ok");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 pb-32 pt-8">
      <h1 className="font-display text-3xl font-bold">{t("translate.title")}</h1>
      <p className="mt-3 text-sm">{t("translation.scope")}</p>
      <p role="status" className="mt-4 rounded-lg border border-border p-4">
        {configured === null
          ? t("common.loading")
          : configured
            ? t("translate.providerTitle")
            : t("translate.unavailable")}
      </p>
      <form
        className="mt-5 space-y-5 rounded-lg border border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label htmlFor="public-phrase" className="block text-sm">
            {t("translation.phrase")}
          </label>
          <select
            id="public-phrase"
            className="mt-2 min-h-12 w-full rounded-lg border border-border p-2"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setConsent(false);
            }}
          >
            <option value="">—</option>
            {phrases.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="translation-target" className="block text-sm">
            {t("translate.to")}
          </label>
          <select
            id="translation-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value as "en" | "hi");
              setResult(null);
            }}
            className="mt-2 min-h-12 w-full rounded-lg border border-border p-2"
          >
            <option value="en">English (en-IN)</option>
            <option value="hi">हिन्दी (hi-IN)</option>
          </select>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          {t("translation.consent")}
        </label>
        <Button type="submit" disabled={!consent || !text || busy || configured !== true}>
          {busy ? t("common.loading") : t("translate.action")}
        </Button>
      </form>
      <section aria-live="polite" aria-busy={busy} className="mt-5">
        {result?.status === "ok" && (
          <>
            <h2 className="text-lg font-bold">{t("translate.output")}</h2>
            <p
              lang={target === "hi" ? "hi-IN" : "en-IN"}
              className="mt-3 whitespace-pre-wrap rounded-lg border border-border p-4"
            >
              {result.translatedText}
            </p>
            <p className="mt-2 text-sm">{t("translate.machine")} · LibreTranslate</p>
            <Button
              className="mt-3"
              onClick={() => result.translatedText && speech.speak(result.translatedText)}
              disabled={!speech.supported.tts}
            >
              {t("translate.listen")}
            </Button>
            {!speech.supported.tts && <p>{t("chat.voiceUnavailable")}</p>}
          </>
        )}
        {failed && (
          <p role="alert" className="rounded-lg border border-critical p-4">
            {t("translate.failed")} {t("translate.unavailable")}
          </p>
        )}
      </section>
      <p className="mt-5 text-sm text-muted-foreground">
        {locale === "hi"
          ? "ऑनलाइन सेवा बंद होने पर भी ऐप की अंग्रेज़ी और हिन्दी भाषा फ़ाइलें उपलब्ध रहती हैं। प्राथमिक चिकित्सा का स्वीकृत हिन्दी अनुवाद अभी उपलब्ध नहीं है।"
          : "Bundled English and Hindi interface text remains available without the online service. Approved Hindi first-aid translations are not yet available."}
      </p>
    </main>
  );
}
