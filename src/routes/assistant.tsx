import { createFileRoute } from "@tanstack/react-router";
import { AssistantChat } from "@/components/AssistantChat";
import { MedicalSources } from "@/components/MedicalSources";
import { MedicationGuidance } from "@/components/MedicationGuidance";
import { VoiceSupport } from "@/components/VoiceSupport";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/assistant")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lifeline assistant · health information and first aid" },
      {
        name: "description",
        content:
          "Ask Lifeline for grounded health information and first-aid guidance, with sources and your own records.",
      },
      { property: "og:title", content: "Lifeline assistant" },
      {
        property: "og:description",
        content: "Grounded health information and first-aid guidance with sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { t, safetyReviewed } = useI18n();
  return (
    <main id="main-content" className="mx-auto flex max-w-4xl flex-col px-4 pb-32 pt-8 sm:px-6">
      <div>
        <p className="text-xs font-medium uppercase text-primary">{t("chat.title")}</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t("chat.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("chat.subtitle")}</p>
        {!safetyReviewed && (
          <p
            role="note"
            className="mt-3 rounded-lg border border-border bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground"
          >
            {t("lang.safetyUnreviewed")}
          </p>
        )}
      </div>
      <AssistantChat className="mt-6 min-h-[32rem]" />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <MedicationGuidance className="lg:col-span-2" />
        <VoiceSupport />
      </div>
      <MedicalSources className="mt-4" />
    </main>
  );
}
