import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { GUIDES, matchGuide } from "@/lib/firstAid";
import { detectEmergency } from "@/lib/knowledge";
import { normaliseAssistantRequest } from "@/lib/assistantLanguages";
import { useSpeech } from "@/hooks/useSpeech";
import { SosButton } from "@/components/SosButton";
import { Button } from "@/components/ui/button";
import { HEALTH_SOURCES } from "@/data/health-sources";
export const Route = createFileRoute("/assistant")({ ssr: false, component: AssistantPage });
const titlesHi: Record<string, string> = {
  cpr: "साँस न लेना · सीपीआर",
  choking: "दम घुटना",
  "chest-pain": "सीने में दर्द",
  stroke: "स्ट्रोक के संकेत",
  "low-sugar": "शर्करा कम होना",
  "high-sugar": "शर्करा अधिक होना",
  "high-bp": "बहुत अधिक रक्तचाप",
  "heart-racing": "दिल तेज़ धड़कना",
  breathing: "साँस लेने में कठिनाई",
  bleeding: "बहुत खून बहना",
  burns: "जलना",
  fall: "गिरना और सिर की चोट",
  fainting: "बेहोशी और चक्कर",
  seizure: "दौरा",
  allergy: "गंभीर एलर्जी",
  heat: "लू लगना",
  poisoning: "ज़हर और अधिक दवा",
  shock: "बिजली का झटका",
};
function AssistantPage() {
  const { t, locale } = useI18n();
  const [question, setQuestion] = useState("");
  const [guideId, setGuideId] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [unmatched, setUnmatched] = useState(false);
  const speech = useSpeech("en-IN");
  const guide = GUIDES.find((g) => g.id === guideId);
  const choose = (id: string) => {
    speech.stopSpeaking();
    setGuideId(id);
    setUnmatched(false);
  };
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 pb-32 pt-8">
      <h1 className="font-display text-3xl font-bold">{t("release.aid")}</h1>
      <p className="mt-3">{t("release.noDelivery")}</p>
      <section className="mt-5 space-y-4 rounded-xl border border-critical p-4">
        <p>{t("release.urgent")}</p>
        <SosButton />
        <Button asChild variant="outline">
          <Link to="/contacts">{t("release.contacts")}</Link>
        </Button>
      </section>
      <p className="mt-5 rounded-lg border border-border p-4 text-sm">
        {t("release.guidanceLanguage")}
      </p>
      <form
        className="mt-5 rounded-lg border border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const normalized = normaliseAssistantRequest(question, locale);
          setUrgent(detectEmergency(question).emergent);
          const g = matchGuide(normalized);
          choose(g?.id ?? "");
          setUnmatched(!g);
        }}
      >
        <label htmlFor="first-aid-search" className="block font-semibold">
          {t("chat.placeholder")}
        </label>
        <textarea
          id="first-aid-search"
          className="mt-3 w-full rounded-lg border border-border p-3"
          rows={2}
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={!question.trim()} className="mt-3">
          {t("chat.send")}
        </Button>
        <p className="mt-3 text-sm">
          {locale === "hi"
            ? "यह खोज इसी डिवाइस पर होती है। बातचीत, प्रोफ़ाइल और रीडिंग किसी एआई सेवा को नहीं भेजी जातीं। यह लक्षणों का सुरक्षित होने का परीक्षण नहीं है।"
            : "This search runs on this device. Chat, profile and readings are not sent to an AI service. A search result is not a safety assessment."}
        </p>
      </form>
      {urgent && (
        <p role="alert" className="mt-4 rounded-lg bg-critical-soft p-4">
          {t("release.urgent")}
        </p>
      )}
      {unmatched && (
        <p role="status" className="mt-4">
          {locale === "hi"
            ? "इस प्रश्न के लिए निर्देश नहीं मिले। नीचे विषय चुनें। स्वास्थ्य समस्या के लिए योग्य चिकित्सक से संपर्क करें; ज़रूरत हो तो आपातकालीन सहायता लें।"
            : "No guide matched this question. Choose a topic below. Contact a qualified clinician about a health concern; seek emergency help if needed."}
        </p>
      )}
      <label htmlFor="guide-topic" className="mt-6 block font-semibold">
        {t("release.aid")}
      </label>
      <select
        id="guide-topic"
        className="mt-3 min-h-12 w-full rounded-lg border border-border p-2"
        value={guideId}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">—</option>
        {GUIDES.map((g) => (
          <option key={g.id} value={g.id}>
            {locale === "hi" ? (titlesHi[g.id] ?? g.title) : g.title}
          </option>
        ))}
      </select>
      {guide && (
        <section
          lang="en-IN"
          aria-labelledby="guide-title"
          className="mt-5 rounded-xl border border-border bg-card p-5"
        >
          <h2 id="guide-title" className="text-xl font-bold">
            {guide.title}
          </h2>
          <p className="mt-3 text-sm">
            Draft v2026.11-rc1 · Adult lay-rescuer information, not paediatric instructions.
            Jurisdiction adaptation and clinical review pending. Reviewer: none; review date: none.
            Follow your local emergency operator.
          </p>
          <p className="mt-4">{guide.intro}</p>
          <ol className="mt-4 list-decimal space-y-3 ps-6">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {guide.avoid?.map((s) => (
            <p key={s} className="mt-4">
              {s}
            </p>
          ))}
          <Button
            className="mt-4"
            disabled={!speech.supported.tts}
            onClick={() =>
              speech.speak(
                [guide.title, guide.intro, ...guide.steps, ...(guide.avoid ?? [])].join(". "),
                undefined,
                { lang: "en-IN" },
              )
            }
          >
            {t("chat.voiceStart")}
          </Button>
          <Button variant="outline" className="ms-3 mt-4" onClick={speech.stopSpeaking}>
            {t("chat.voiceStop")}
          </Button>
          {!speech.supported.tts && (
            <p className="mt-3" lang={locale === "hi" ? "hi-IN" : "en-IN"}>
              {t("chat.voiceUnavailable")}
            </p>
          )}
        </section>
      )}
      <details className="mt-5 rounded-lg border border-border p-4">
        <summary className="min-h-11 cursor-pointer py-2">{t("chat.sources")}</summary>
        <ul lang="en-IN" className="space-y-3">
          {HEALTH_SOURCES.filter((s) =>
            ["ifrc-first-aid", "indian-red-cross", "nhs-conditions"].includes(s.id),
          ).map((s) => (
            <li key={s.id}>
              <a className="text-primary underline" href={s.url} rel="noreferrer" target="_blank">
                {s.title}
              </a>
              <p className="text-sm">
                {s.publisher} · {s.jurisdiction} · Clinical review not recorded
              </p>
            </li>
          ))}
        </ul>
      </details>
      <Button asChild variant="outline" className="mt-5 h-auto min-h-12 whitespace-normal">
        <a href="/offline.html">{t("release.offline")}</a>
      </Button>
    </main>
  );
}
