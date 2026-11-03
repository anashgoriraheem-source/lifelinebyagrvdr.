import { Link } from "@tanstack/react-router";
import {
  Activity,
  HeartPulse,
  House,
  Languages,
  LifeBuoy,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { isStale } from "@/lib/detection";
import { useI18n } from "@/i18n";
import { LanguagePicker } from "@/components/LanguagePicker";

export function Nav() {
  const demo = useApp((s) => s.demoMode);
  const alarm = useApp((s) => s.alarm.phase);
  const device = useApp((s) => s.device.status);
  const vitals = useApp((s) => s.vitals);
  const now = useNow();
  const { t } = useI18n();
  const fresh = Object.entries(vitals).some(
    ([k, r]) => r && !isStale(k as keyof typeof vitals, r, now),
  );
  const status =
    alarm !== "idle"
      ? t("safety.alertActive")
      : demo
        ? t("status.demo")
        : device === "connected" && fresh
          ? t("status.receiving")
          : device === "connected"
            ? t("status.waiting")
            : t("status.inactive");
  return (
    <header className="relative z-30 border-b border-border bg-background">
      <a href="#main-content" className="skip-link">
        {t("common.skip")}
      </a>
      <div className="mx-auto flex flex-wrap max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label={t("nav.home")}>
          <span className="grid size-10 place-items-center rounded-lg border border-border text-primary">
            <HeartPulse className="size-6" strokeWidth={1.6} />
          </span>
          <span className="font-display text-lg font-bold leading-none sm:text-xl">
            <span className="block tracking-[0.02em]">AAPDA</span>
            <span className="block tracking-[0.02em] text-primary">SETU</span>
          </span>
        </Link>

        <nav aria-label={t("nav.primary")} className="app-nav ms-auto flex items-center gap-0.5">
          <Link to="/" className="app-nav-link" activeOptions={{ exact: true }}>
            <House className="size-4" aria-hidden="true" />
            {t("nav.home")}
          </Link>
          <Link to="/monitor" className="app-nav-link">
            <Activity className="size-4" aria-hidden="true" />
            {t("nav.monitor")}
          </Link>
          <Link to="/assistant" className="app-nav-link">
            <Sparkles className="size-4" aria-hidden="true" />
            {t("nav.assistant")}
          </Link>
          <Link to="/contacts" className="app-nav-link">
            <Users className="size-4" aria-hidden="true" />
            {t("nav.contacts")}
          </Link>
          <Link to="/account" className="app-nav-link">
            <UserRound className="size-4" aria-hidden="true" />
            {t("nav.account")}
          </Link>
          <span className="nav-optional">
            <Link to="/translate" className="app-nav-link">
              <Languages className="size-4" aria-hidden="true" />
              {t("nav.translate")}
            </Link>
          </span>
          <span className="nav-optional">
            <Link to="/saath" className="app-nav-link">
              <LifeBuoy className="size-4" aria-hidden="true" />
              Saath
            </Link>
          </span>
        </nav>

        <LanguagePicker className="shrink-0" />
        <details className="relative nav-mobile">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 text-sm">
            {t("nav.more")}
          </summary>
          <div className="absolute end-0 top-full z-50 min-w-44 rounded-lg border border-border bg-card p-2">
            <Link to="/translate" className="app-nav-link">
              {t("nav.translate")}
            </Link>
            <Link to="/saath" className="app-nav-link">
              Saath
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
