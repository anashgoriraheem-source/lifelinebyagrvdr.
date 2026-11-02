import { useEffect, useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, Loader2, Pill, Phone, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useApp } from "@/hooks/useApp";
import { emergencyNumbers } from "@/lib/store";
import { telHref } from "@/lib/sos";
import {
  askAboutMedicine,
  medicationStatus,
  type MedicationReferenceRow,
  type MedicationReply,
} from "@/lib/medications.functions";

interface Status {
  state: {
    enabled: boolean;
    blocker: string | null;
    referenceVersion: string;
    jurisdiction: string;
    reviewStatus: string;
  };
  sources: { id: string; title: string; publisher: string; url: string; version: string }[];
  entries: MedicationReferenceRow[];
}

const list = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Non-prescription medicine information with hard safety gates. The panel is
 * usable while guidance is disabled: it still escalates emergencies, refuses
 * unsafe options, and shows the reference warnings with their sources.
 */
export function MedicationGuidance({ className }: { className?: string }) {
  const { t } = useI18n();
  const profile = useApp((s) => s.profile);
  const emergency = useApp(emergencyNumbers);
  const statusFn = useServerFn(medicationStatus);
  const ask = useServerFn(askAboutMedicine);
  const [status, setStatus] = useState<Status | null>(null);
  const [reply, setReply] = useState<MedicationReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const [pregnancy, setPregnancy] = useState<"no" | "pregnant" | "breastfeeding" | "unknown">(
    "unknown",
  );
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [conditions, setConditions] = useState(profile.conditions.join(", "));
  const [medicines, setMedicines] = useState(profile.medications.join(", "));
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    let active = true;
    statusFn()
      .then((s) => {
        if (active) setStatus(s as Status);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, [statusFn]);

  const submit = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ask({
        data: {
          question,
          factors: {
            ageYears: age.trim() ? Number(age) : null,
            pregnancy,
            allergies: allergies.trim() ? list(allergies) : null,
            conditions: conditions.trim() ? list(conditions) : null,
            currentMedicines: medicines.trim() ? list(medicines) : null,
          },
        },
      });
      setReply(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const input =
    "mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
  const decision = reply?.decision;

  return (
    <section
      aria-labelledby={`med-${uid}`}
      className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Pill className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 id={`med-${uid}`} className="font-display text-lg font-bold">
            {t("med.title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("med.subtitle")}</p>
        </div>
      </div>

      {status && !status.state.enabled && (
        <p
          role="note"
          className="mt-3 rounded-lg border border-warning bg-warning-soft p-3 text-xs leading-relaxed"
        >
          <span className="font-semibold">{t("med.disabledHeading")}</span> {status.state.blocker}
        </p>
      )}

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="text-sm sm:col-span-2">
          {t("med.question")}
          <input
            className={input}
            value={question}
            maxLength={600}
            placeholder={t("med.questionPlaceholder")}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          {t("med.age")}
          <input
            className={input}
            type="number"
            min={0}
            max={130}
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </label>
        <label className="text-sm">
          {t("med.pregnancy")}
          <select
            className={input}
            value={pregnancy}
            onChange={(e) => setPregnancy(e.target.value as typeof pregnancy)}
          >
            <option value="unknown">{t("med.notGiven")}</option>
            <option value="no">{t("med.notPregnant")}</option>
            <option value="pregnant">{t("med.pregnant")}</option>
            <option value="breastfeeding">{t("med.breastfeeding")}</option>
          </select>
        </label>
        <label className="text-sm">
          {t("med.allergies")}
          <input
            className={input}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder={t("med.commaHint")}
          />
        </label>
        <label className="text-sm">
          {t("med.conditions")}
          <input
            className={input}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder={t("med.commaHint")}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          {t("med.currentMeds")}
          <input
            className={input}
            value={medicines}
            onChange={(e) => setMedicines(e.target.value)}
            placeholder={t("med.commaHint")}
          />
        </label>
        <Button type="submit" disabled={busy || !question.trim()} className="sm:col-span-2">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? t("common.loading") : t("med.check")}
        </Button>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-critical bg-critical-soft p-3 text-sm">
            {error}
          </p>
        )}

        {decision?.kind === "emergency" && (
          <div role="alert" className="rounded-lg border border-critical bg-critical-soft p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-critical">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("med.emergencyHeading")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{decision.message}</p>
            <a
              href={telHref(emergency.general)}
              className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-critical px-3 text-sm font-bold text-destructive-foreground"
            >
              <Phone className="size-4" aria-hidden="true" />
              {t("safety.callEmergency")} · {emergency.general}
            </a>
          </div>
        )}

        {decision && decision.kind !== "emergency" && (
          <div
            className={`rounded-lg border p-3 ${
              decision.kind === "information"
                ? "border-border bg-background/60"
                : "border-warning bg-warning-soft"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              {decision.kind === "information" ? (
                <Info className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
              )}
              {decision.kind === "information"
                ? t("med.informationHeading")
                : decision.kind === "disabled"
                  ? t("med.disabledHeading")
                  : t("med.refusedHeading")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{decision.message}</p>
            {decision.kind === "information" && (
              <p className="mt-2 text-xs font-medium text-primary">{t("med.labelOnly")}</p>
            )}
            {decision.entry && (
              <div className="mt-3 border-t border-border pt-2 text-xs">
                <p className="font-semibold text-foreground">
                  {decision.entry.entry.genericName}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({t("med.genericOnly")})
                  </span>
                </p>
                {decision.entry.entry.warnings.length > 0 && (
                  <ul className="mt-1 list-disc ps-5 text-muted-foreground">
                    {decision.entry.entry.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                <ul className="mt-2 space-y-1">
                  {decision.entry.sources.map((s) => (
                    <li key={s.id}>
                      <a
                        className="text-primary underline-offset-2 hover:underline"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.title}
                      </a>{" "}
                      <span className="text-muted-foreground">
                        · {s.publisher} · {s.version}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decision.checks.length > 0 && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="min-h-11 cursor-pointer py-2">
                  {t("med.factorsChecked")}
                </summary>
                <ul className="ms-4 list-disc space-y-0.5">
                  {decision.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {status && (
        <details className="mt-4 rounded-lg border border-border bg-background/40 p-3 text-xs">
          <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground">
            {t("med.referenceSummary", { version: status.state.referenceVersion })}
          </summary>
          <p className="text-muted-foreground">
            {t("med.jurisdiction")}: {status.state.jurisdiction} ·{" "}
            {status.state.reviewStatus === "clinically-reviewed"
              ? t("med.reviewed")
              : t("med.notReviewed")}
          </p>
          <ul className="mt-2 space-y-2">
            {status.entries.map((entry) => (
              <li key={entry.id}>
                <p className="font-medium text-foreground">{entry.genericName}</p>
                <p className="text-muted-foreground">{entry.indication}</p>
                <p className="text-muted-foreground">
                  {t("med.interactions")}: {entry.interactions.join(", ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  {entry.sources.map((s) => s.publisher).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("med.disclaimer")}</p>
    </section>
  );
}
