import { useId } from "react";
import { Languages } from "lucide-react";
import { useI18n } from "@/i18n";
import { auditLocale, describeLocale } from "@/i18n/coverage";
import type { LocaleCode } from "@/i18n/locales";
import { cn } from "@/lib/utils";

interface Props {
  /** `compact` is the header control; `full` adds status and coverage detail. */
  variant?: "compact" | "full";
  id?: string;
  className?: string;
}

/**
 * Global interface-language selector. Choosing a language previews it
 * immediately and persists it (device-local when signed out, saved to the
 * account when signed in). Its status line comes from the pack audit, so a
 * locale is never described as complete while strings are missing.
 */
export function LanguagePicker({ variant = "compact", id, className }: Props) {
  const { locale, setLanguage, t, locales } = useI18n();
  const generated = useId();
  const selectId = id ?? `language-${generated}`;
  const audit = auditLocale(locale);
  const described = describeLocale(audit);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label
        htmlFor={selectId}
        className={variant === "compact" ? "sr-only" : "text-sm font-medium text-muted-foreground"}
      >
        {t("lang.label")}
      </label>
      <div className="relative flex items-center">
        <Languages
          aria-hidden
          className="pointer-events-none absolute start-2 size-4 text-primary"
        />
        <select
          id={selectId}
          value={locale}
          onChange={(e) => setLanguage(e.target.value as LocaleCode)}
          aria-describedby={variant === "full" ? `${selectId}-status` : undefined}
          className="min-h-11 max-w-[13rem] truncate rounded-lg border border-border bg-card ps-8 pe-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {locales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} · {l.englishName}
            </option>
          ))}
        </select>
      </div>
      {variant === "full" && (
        <p id={`${selectId}-status`} className="text-xs leading-relaxed text-muted-foreground" role="status">
          {described.tone === "complete"
            ? t("lang.status.complete")
            : described.tone === "machine"
              ? t("lang.status.machine-draft")
              : t("lang.status.partial")}
          {" · "}
          {t("lang.coverage", { done: Math.round(audit.coverage * 100) })}
          {audit.missingKeys.length > 0 &&
            ` · ${t("lang.missing", { count: audit.missingKeys.length })}`}
          {!audit.safetyReviewed && ` · ${t("lang.safetyUnreviewed")}`}
        </p>
      )}
    </div>
  );
}
