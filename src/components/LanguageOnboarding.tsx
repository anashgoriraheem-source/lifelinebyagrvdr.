import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/i18n";
import { localeByCode } from "@/i18n/locales";
import { useApp } from "@/hooks/useApp";
import { set } from "@/lib/store";

/**
 * First-run language step. It previews a language immediately and records the
 * choice (device-local until the person signs in), so onboarding does not rely
 * on someone finding the header control.
 */
export function LanguageOnboarding() {
  const chosen = useApp((s) => s.languageChosen);
  const { t, locale } = useI18n();
  if (chosen) return null;
  return (
    <section
      aria-labelledby="onboarding-language"
      className="mt-6 rounded-xl border border-primary/40 bg-card p-4"
    >
      <h2 id="onboarding-language" className="font-display text-lg font-bold">
        {t("onboarding.title")}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t("onboarding.body")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <LanguagePicker variant="full" />
        <Button type="button" onClick={() => set({ languageChosen: true })}>
          <Check className="size-4" aria-hidden="true" />
          {t("onboarding.confirm", { language: localeByCode(locale).nativeName })}
        </Button>
      </div>
    </section>
  );
}
