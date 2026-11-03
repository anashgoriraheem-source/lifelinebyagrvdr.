import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { classify, isStale } from "@/lib/detection";
import type { VitalKey } from "@/lib/types";
export function VitalCard({ k }: { k: VitalKey; delay?: number }) {
  const r = useApp((s) => s.vitals[k]);
  const limits = useApp((s) => s.thresholds[k]);
  const demo = useApp((s) => s.demoMode);
  const { t, formatNumber, formatTime } = useI18n();
  const now = useNow();
  const stale = r && isStale(k, r, now);
  const status = classify(k, r, limits);
  const label = !r
    ? "release.noData"
    : stale
      ? "release.stale"
      : demo
        ? "release.synthetic"
        : r.quality !== "good"
          ? "release.uncertain"
          : status === "critical"
            ? "release.critical"
            : status === "warning"
              ? "release.watch"
              : "release.normal";
  const unit =
    k === "hr"
      ? "release.unitHr"
      : k === "bp"
        ? "release.unitBp"
        : k === "spo2"
          ? "release.unitOxygen"
          : "release.unitGlucose";
  const value =
    !r || stale
      ? "—"
      : k === "bp"
        ? `${formatNumber(Math.round(r.value))}/${r.value2 == null ? "—" : formatNumber(Math.round(r.value2))}`
        : formatNumber(Math.round(r.value));
  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{t(`reading.${k}`)}</h2>
      <p className="mt-4 break-words font-mono text-3xl font-bold">
        {value} <span className="text-sm font-normal text-muted-foreground">{t(unit)}</span>
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{t(label)}</p>
      <p className="mt-2 break-words text-xs text-muted-foreground">
        {r
          ? `${r.source} · ${t("release.receivedAt", { time: formatTime(r.receivedAt) })}`
          : t("release.noMeasurement")}
      </p>
    </article>
  );
}
