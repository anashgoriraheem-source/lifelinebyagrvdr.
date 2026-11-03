import { createFileRoute } from "@tanstack/react-router";
import { FieldGuideMegaMenu } from "@/components/FieldGuideMegaMenu";
import { SosButton } from "@/components/SosButton";

export const Route = createFileRoute("/guide")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Field guide · Lifeline" },
      {
        name: "description",
        content:
          "Browse Lifeline's first-aid guides by urgency, read a topic, and open the saved offline page.",
      },
      { property: "og:title", content: "Field guide · Lifeline" },
      {
        property: "og:description",
        content:
          "Browse Lifeline's first-aid guides by urgency, read a topic, and open the saved offline page.",
      },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <main id="main-content" tabIndex={-1} className="pb-28">
      <FieldGuideMegaMenu />
      <section
        className="mx-auto mt-10 grid max-w-6xl gap-5 border-t border-border px-4 pt-8 sm:grid-cols-[1fr_auto] sm:px-6"
        aria-labelledby="guide-emergency-heading"
      >
        <div>
          <h2 id="guide-emergency-heading" className="text-xl font-bold">
            If someone is in danger now
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed">
            Call your local emergency number first and ask a nearby person who can help to come. A
            guide is a reminder of what to do while you wait — it cannot call anyone, and it does
            not replace the operator&apos;s instructions.
          </p>
        </div>
        <SosButton />
      </section>
    </main>
  );
}
