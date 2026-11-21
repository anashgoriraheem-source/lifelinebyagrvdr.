import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SosButton } from "@/components/SosButton";
import { LocationCard } from "@/components/LocationCard";
import { LocationGlobe } from "@/components/LocationGlobe";
import { SessionMapInfographic } from "@/components/SessionMapInfographic";
import { AutomaticAlertStatus } from "@/components/AutomaticAlertStatus";
import { MovementMonitorCard } from "@/components/MovementMonitorCard";
import { useApp } from "@/hooks/useApp";
import { set } from "@/lib/store";
import { useI18n } from "@/i18n";
export const Route = createFileRoute("/monitor")({ ssr: false, component: Monitor });
function Monitor() {
  const { t } = useI18n();
  const demo = useApp((s) => s.demoMode);
  const toggleDemo = () => set({ demoMode: !demo });
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="monitor-page mx-auto max-w-6xl px-4 pb-32 pt-8"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-critical">
        {t("release.emergencyMode")}
      </p>
      <h1 className="font-display text-3xl font-bold">{t("release.monitor")}</h1>
      <p className="mt-3 max-w-3xl">{t("release.monitorIntro")}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
        <p role="status" className="font-semibold">
          {demo
            ? t("release.demo")
            : "Fall and movement monitoring is available only while this page is open and sensor permission is granted."}
        </p>
        <SosButton />
      </div>
      <div className="mt-8">
        <MovementMonitorCard />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <LocationCard />
        <LocationGlobe />
      </div>
      <div className="mt-8">
        <SessionMapInfographic />
      </div>
      <AutomaticAlertStatus />
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="outline" onClick={toggleDemo}>
          {t(demo ? "release.demoStop" : "release.demoStart")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/assistant">{t("release.aid")}</Link>
        </Button>
      </div>
      <details className="mt-6 rounded-lg border border-border p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          {t("release.more")}
        </summary>
        <p className="text-sm">{t("release.profileNote")}</p>
        <Button asChild variant="outline" className="mt-3 h-auto min-h-12 whitespace-normal">
          <Link to="/account">{t("release.account")}</Link>
        </Button>
      </details>
    </main>
  );
}
