import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, BookOpenCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { medicalSources } from "@/lib/assistant.functions";

type Summary = Awaited<ReturnType<typeof medicalSources>>;

/**
 * The source register behind the assistant. Every item keeps its publisher,
 * jurisdiction, publication date and review state; a source without a review
 * date says so instead of implying one.
 */
export function MedicalSources({ className }: { className?: string }) {
  const { t, formatDateTime } = useI18n();
  const load = useServerFn(medicalSources);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [load]);

  if (!data) return null;

  return (
    <section
      aria-labelledby="sources-heading"
      className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}
    >
      <h2 id="sources-heading" className="flex items-center gap-2 font-display text-lg font-bold">
        <BookOpenCheck className="size-5 text-primary" aria-hidden="true" />
        {t("sources.title")}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("sources.version", { version: data.version })} ·{" "}
        {t("sources.lastChecked", { date: data.lastChecked ?? t("common.notAvailable") })} ·{" "}
        {String(data.reviewStatus) === "clinically-reviewed"
          ? t("med.reviewed")
          : t("med.notReviewed")}
      </p>
      <p role="note" className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t("sources.notReviewedNote")}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.sources.map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-background/40 p-3">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {s.title}
              <ArrowUpRight className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.publisher} · {s.jurisdiction}
              {s.published ? ` · ${s.published}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("sources.reviewStatus")}:{" "}
              {s.reviewed ? formatDateTime(s.reviewed) : t("med.notReviewed")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
