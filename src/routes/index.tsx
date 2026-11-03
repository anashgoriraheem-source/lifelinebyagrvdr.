import { createFileRoute, Link } from "@tanstack/react-router";
import { Bluetooth, Users, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SosButton } from "@/components/SosButton";
import { LanguageOnboarding } from "@/components/LanguageOnboarding";
import { VitalCard } from "@/components/VitalCard";
import { ReadingsDashboard } from "@/components/ReadingsDashboard";
import { useI18n } from "@/i18n";
export const Route = createFileRoute("/")({ ssr: false, component: Home });
function Home() {
  const { t } = useI18n();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Lifeline</p>
      <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{t("release.title")}</h1>
      <p className="mt-4 max-w-3xl text-lg">{t("release.intro")}</p>
      <LanguageOnboarding />
      <section
        className="mt-6 grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-[1fr_auto]"
        aria-labelledby="urgent-heading"
      >
        <div>
          <h2 id="urgent-heading" className="text-xl font-bold">
            {t("release.actions")}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed">{t("release.urgent")}</p>
        </div>
        <SosButton />
      </section>
      <section className="mt-8" aria-labelledby="setup-heading">
        <h2 id="setup-heading" className="text-2xl font-bold">
          {t("release.steps")}
        </h2>
        <ol className="mt-4 grid list-inside list-decimal gap-4 md:grid-cols-3">
          {(["release.step1", "release.step2", "release.step3"] as const).map((k, i) => (
            <li key={k} className="rounded-xl border border-border bg-card p-5">
              <span>{t(k)}</span>
              <Button
                asChild
                variant="outline"
                className="mt-4 h-auto min-h-12 w-full whitespace-normal text-start"
              >
                <Link to={i === 0 ? "/contacts" : i === 1 ? "/monitor" : "/assistant"}>
                  {i === 0 ? (
                    <Users aria-hidden />
                  ) : i === 1 ? (
                    <Bluetooth aria-hidden />
                  ) : (
                    <BookOpen aria-hidden />
                  )}
                  {t(i === 0 ? "release.contacts" : i === 1 ? "release.connect" : "release.aid")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </li>
          ))}
        </ol>
      </section>
      <ReadingsDashboard />
      <section className="mt-8" aria-labelledby="readings-heading">
        <h2 id="readings-heading" className="text-2xl font-bold">
          {t("release.monitor")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["hr", "spo2", "bp", "glucose"] as const).map((k) => (
            <VitalCard key={k} k={k} />
          ))}
        </div>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">{t("release.noDelivery")}</p>
      <Button asChild variant="outline" className="mt-5 h-auto min-h-12 whitespace-normal">
        <a href="/offline.html">{t("release.offline")}</a>
      </Button>
    </main>
  );
}
