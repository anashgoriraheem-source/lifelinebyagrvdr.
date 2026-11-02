import { useEffect, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n";
import { useSpeech } from "@/hooks/useSpeech";

/**
 * Reports what this browser can actually speak and listen to, per language.
 * A language with no matching device voice is shown as text-only — the app
 * never implies a voice exists for a language it has not found one for.
 */
export function VoiceSupport({ className }: { className?: string }) {
  const { t, locales } = useI18n();
  const speech = useSpeech();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    setVoices(speech.voices);
  }, [speech.voices]);

  const countFor = (tag: string) => {
    const base = tag.split("-")[0].toLowerCase();
    return voices.filter(
      (v) =>
        v.lang.toLowerCase() === tag.toLowerCase() ||
        v.lang.toLowerCase().split("-")[0] === base,
    ).length;
  };

  return (
    <section
      aria-labelledby="voice-heading"
      className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}
    >
      <h2 id="voice-heading" className="flex items-center gap-2 font-display text-lg font-bold">
        <Volume2 className="size-5 text-primary" aria-hidden="true" />
        {t("voice.title")}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("voice.subtitle")}</p>

      <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed">
        {speech.supported.stt ? (
          <Mic className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <VolumeX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        {speech.supported.stt ? t("voice.inputAvailable") : t("voice.inputUnavailable")}
      </p>

      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {locales.map((l) => {
          const count = countFor(l.tag);
          return (
            <li
              key={l.code}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0"
            >
              <span lang={l.tag} dir={l.dir}>
                {l.nativeName}
                <span className="ms-2 text-muted-foreground">{l.englishName}</span>
              </span>
              <span className={count > 0 ? "text-success" : "text-muted-foreground"}>
                {count > 0 ? t("voice.deviceVoices", { count }) : t("voice.none")}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {t("voice.testedNote")}
      </p>
    </section>
  );
}
