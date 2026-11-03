import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SosButton } from "@/components/SosButton";
import { VitalCard } from "@/components/VitalCard";
import { DevicePairing } from "@/components/DevicePairing";
import { ReadingMonthsChart } from "@/components/ReadingMonthsChart";
import { LocationCard } from "@/components/LocationCard";
import { LocationGlobe } from "@/components/LocationGlobe";
import { SessionMapInfographic } from "@/components/SessionMapInfographic";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { set } from "@/lib/store";
import { disconnectWearable } from "@/core/ble/connect";
import { connectionPhase } from "@/core/ble/support";
import { useI18n } from "@/i18n";
export const Route = createFileRoute("/monitor")({ ssr: false, component: Monitor });
function Monitor() {
  const { t } = useI18n();
  const device = useApp((s) => s.device);
  const demo = useApp((s) => s.demoMode);
  const vitals = useApp((s) => s.vitals);
  const now = useNow();
  // The device status line uses the same rule as the pairing card, so "connected"
  // never means "monitoring" and a connection that has gone quiet says so.
  const phase = connectionPhase({ device, vitals, now });
  const status =
    phase === "receiving"
      ? "release.receiving"
      : phase === "connected"
        ? "release.connected"
        : phase === "stale"
          ? "release.deviceStale"
          : phase === "reconnecting"
            ? "release.reconnecting"
            : phase === "disconnected" || phase === "error"
              ? "release.lost"
              : "release.noDevice";
  const toggleDemo = () => {
    disconnectWearable();
    set({
      demoMode: !demo,
      scenario: "stable",
      vitals: {},
      history: { hr: [], spo2: [], bp: [], glucose: [] },
    });
  };
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="monitor-page mx-auto max-w-6xl px-4 pb-32 pt-8"
    >
      <h1 className="font-display text-3xl font-bold">{t("release.monitor")}</h1>
      <p className="mt-3 max-w-3xl">{t("release.monitorIntro")}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
        <p role="status" className="font-semibold">
          {t(demo ? "release.demo" : status)}
        </p>
        <SosButton />
      </div>
      <DevicePairing />
      <section
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("release.monitor")}
      >
        {(["hr", "spo2", "bp", "glucose"] as const).map((k) => (
          <VitalCard key={k} k={k} />
        ))}
      </section>
      <div className="mt-8">
        <ReadingMonthsChart />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <LocationCard />
        <LocationGlobe />
      </div>
      <div className="mt-8">
        <SessionMapInfographic />
      </div>
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
