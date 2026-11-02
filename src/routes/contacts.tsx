import { AlertHistory } from "@/components/AlertHistory";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { saveSafetyContacts, saveSafetyPreferences } from "@/lib/account.functions";
import { getProviderStatus } from "@/lib/dispatch.functions";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ambulance,
  Flame,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Shield,
  Siren,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { DEFAULT_THRESHOLDS, EMERGENCY_BY_COUNTRY, RELATIONSHIPS } from "@/lib/fixtures";
import { appStore, emergencyNumbers, set } from "@/lib/store";
import { VITAL_META, thresholdError } from "@/lib/detection";
import { buildSosMessage, isValidPhone, smsHref, telHref } from "@/lib/sos";
import { useI18n } from "@/i18n";
import type { Contact, VitalKey } from "@/lib/types";

export const Route = createFileRoute("/contacts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contacts and alerts · Lifeline" },
      {
        name: "description",
        content: "Manage your personal emergency contacts and alert preferences.",
      },
      { property: "og:title", content: "Contacts and alerts · Lifeline" },
      {
        property: "og:description",
        content: "Manage your personal emergency contacts and alert preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contacts,
});

const card = "border-t border-border py-6";

function Contacts() {
  const { t } = useI18n();
  const contacts = useApp((s) => s.contacts);
  const country = useApp((s) => s.countryCode);
  const countdown = useApp((s) => s.countdownSeconds);
  const thresholds = useApp((s) => s.thresholds);
  const fix = useApp((s) => s.location.fix);
  const n = useApp(emergencyNumbers);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const userId = useApp((s) => s.userId);
  const accountStatus = useApp((s) => s.accountStatus);
  const saveCloud = useServerFn(saveSafetyContacts);
  const savePrefs = useServerFn(saveSafetyPreferences);
  const providerFn = useServerFn(getProviderStatus);
  const [provider, setProvider] = useState<{
    mode: "test" | "live";
    liveReady: boolean;
    sms: boolean;
    voice: boolean;
    email: boolean;
    missing: string[];
    policySteps: string[];
  } | null>(null);
  const dispatchConsent = useApp((s) => s.dispatchConsent);
  const shareLocation = useApp((s) => s.shareLocation);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [tErr, setTErr] = useState<Partial<Record<VitalKey, string | null>>>({});

  /** Reject impossible or contradictory limits; keep the previous value when rejected. */
  const editThreshold = (k: VitalKey, f: "below" | "above" | "above2", raw: string) =>
    set((s) => {
      const t = { ...s.thresholds[k], [f]: raw === "" ? null : Number(raw) };
      const err = thresholdError(k, t);
      setTErr((e) => ({ ...e, [k]: err }));
      return err ? {} : { thresholds: { ...s.thresholds, [k]: t } };
    });

  const move = (i: number, d: -1 | 1) =>
    set((s) => {
      const c = [...s.contacts];
      const j = i + d;
      if (j < 0 || j >= c.length) return {};
      [c[i], c[j]] = [c[j], c[i]];
      return { contacts: c };
    });
  const patch = (id: string, p: Partial<Contact>) =>
    set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  const smsList = contacts.filter((c) => c.sms);

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
      <h1 className="font-display text-4xl font-extrabold tracking-normal">
        {t("contacts.title")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("contacts.subtitle")}</p>

      {/* Emergency services */}
      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-display text-xl font-bold">
            {t("contacts.emergencyHeading")}
          </h2>
          <label className="text-sm text-muted-foreground">
            {t("contacts.country")}{" "}
            <select
              value={country}
              onChange={(e) => set({ countryCode: e.target.value })}
              className="ml-1 rounded-lg border border-border bg-card px-2 py-1 text-foreground"
            >
              {Object.entries(EMERGENCY_BY_COUNTRY).map(([code, v]) => (
                <option key={code} value={code}>
                  {v.country}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: t("contacts.emergencyGeneral"),
              num: n.general,
              icon: Siren,
              c: "bg-destructive text-destructive-foreground",
            },
            { label: t("contacts.police"), num: n.police, icon: Shield, c: "bg-muted" },
            {
              label: t("contacts.ambulance"),
              num: n.ambulance,
              icon: Ambulance,
              c: "bg-muted",
            },
            { label: t("contacts.fire"), num: n.fire, icon: Flame, c: "bg-muted" },
          ].map((x) => (
            <a
              key={x.label}
              href={telHref(x.num)}
              className={`rounded-lg p-4 transition hover:-translate-y-0.5 ${x.c}`}
            >
              <x.icon className="size-5 opacity-80" />
              <p className="mt-2 text-xs font-semibold opacity-70">{x.label}</p>
              <p className="font-mono text-2xl font-bold">{x.num}</p>
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {t("contacts.emergencyNote", {
            extra: n.smsVerified
              ? t("contacts.emergencyNoteSms", { number: n.smsNumber })
              : "",
          })}
        </p>
        {!n.smsVerified && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t("contacts.emergencySmsUnverified", {
              country: n.country,
              note: n.smsNote ?? "",
            })}
          </p>
        )}
      </section>

      {/* Personal contacts */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center gap-3">
          <div className="mr-auto">
            <h2 className="font-display text-xl font-bold">{t("contacts.personalHeading")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("contacts.orderNote")}{" "}
              {userId ? t("contacts.accountPending") : t("contacts.deviceOnly")}
            </p>
          </div>
          <Button
            disabled={!!userId && accountStatus !== "ready"}
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-foreground"
          >
            <Plus className="size-4" /> {t("contacts.add")}
          </Button>
        </div>
        {contacts.length === 0 && (
          <div className="mt-5 rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("contacts.empty")}
          </div>
        )}
        <ol className="mt-4 space-y-2">
          {contacts.map((c, i) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 ring-1 ring-border"
            >
              <span className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-foreground">
                {i + 1}
              </span>
              <div className="mr-auto min-w-0">
                <p className="truncate font-semibold">
                  {c.name}
                  {i === 0 && <span className="ml-2 text-xs text-primary">{t("contacts.primary")}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.relationship} · <span className="font-mono">{c.phone}</span>
                  {c.email ? ` · ${c.email}` : ""}
                </p>
                <p className={`text-[11px] ${c.confirmedAt ? "text-success" : "text-warning"}`}>
                  {c.confirmedAt ? t("contacts.confirmed") : t("contacts.unconfirmed")}
                  {c.testDestination !== false ? ` · ${t("contacts.testDestination")}` : ""}
                </p>
              </div>
              <Toggle
                on={c.call}
                onClick={() => patch(c.id, { call: !c.call })}
                icon={<Phone className="size-3.5" />}
                label={t("contacts.channelCall")}
              />
              <Toggle
                on={c.sms}
                onClick={() => patch(c.id, { sms: !c.sms })}
                icon={<MessageSquare className="size-3.5" />}
                label={t("contacts.channelSms")}
              />
              <Toggle
                on={Boolean(c.emailAlerts)}
                onClick={() => patch(c.id, { emailAlerts: !c.emailAlerts })}
                icon={<Mail className="size-3.5" />}
                label={t("contacts.channelEmail")}
              />
              <div className="flex">
                <IconBtn label={t("contacts.moveUp")} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-4" />
                </IconBtn>
                <IconBtn
                  label={t("contacts.moveDown")}
                  onClick={() => move(i, 1)}
                  disabled={i === contacts.length - 1}
                >
                  <ArrowDown className="size-4" />
                </IconBtn>
                <IconBtn label={t("contacts.edit")} onClick={() => setEditing(c)}>
                  <Pencil className="size-4" />
                </IconBtn>
                <IconBtn
                  label={t("contacts.delete")}
                  onClick={() =>
                    confirm(t("contacts.removeConfirm", { name: c.name })) &&
                    set((s) => ({ contacts: s.contacts.filter((x) => x.id !== c.id) }))
                  }
                >
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ol>
        {userId ? (
          <Button
            className="mt-4"
            disabled={saving || accountStatus !== "ready"}
            onClick={async () => {
              setSaving(true);
              setSaveStatus("");
              try {
                await saveCloud({
                  data: contacts.map((c) => ({ ...c, phone: c.phone.replace(/[^\d+]/g, "") })),
                });
                await savePrefs({
                  data: { language: appStore.state.language, dispatchConsent, shareLocation },
                });
                setSaveStatus(t("contacts.saved"));
              } catch (e) {
                setSaveStatus(e instanceof Error ? e.message : t("contacts.saveFailed"));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? t("contacts.saving") : t("contacts.saveToAccount")}
          </Button>
        ) : (
          <Link to="/account" className="mt-4 inline-block text-primary underline">
            {t("contacts.signInToSave")}
          </Link>
        )}
        {saveStatus && (
          <p role="status" className="mt-2 text-sm">
            {saveStatus}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-accent p-4 text-sm text-primary">
          <p className="mr-auto">{t("contacts.testNotice")}</p>
          <a
            href={
              smsList.length
                ? smsHref(
                    smsList.map((c) => c.phone),
                    buildSosMessage(
                      { type: "sos", label: t("contacts.testReason"), reading: t("contacts.testReading") },
                      fix,
                      { test: true },
                    ),
                  )
                : undefined
            }
            className={`rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground ${smsList.length ? "" : "pointer-events-none opacity-40"}`}
          >
            {t("contacts.testAction")}
          </a>
        </div>
      </section>

      <section className={`${card} mt-5`}>
        <h2 className="font-display text-xl font-bold">{t("contacts.autoHeading")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("contacts.autoIntro")}
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-lg bg-background p-3 ring-1 ring-border">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              checked={dispatchConsent}
              onChange={(e) => set({ dispatchConsent: e.target.checked })}
            />
            <span className="text-sm">
              <span className="block font-semibold">{t("contacts.consent")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("contacts.consentBody")}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg bg-background p-3 ring-1 ring-border">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              checked={shareLocation}
              onChange={(e) => set({ shareLocation: e.target.checked })}
            />
            <span className="text-sm">
              <span className="block font-semibold">{t("contacts.location")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("contacts.locationBody")}
              </span>
            </span>
          </label>
        </div>
        <div className="mt-4 rounded-lg bg-background p-3 text-xs ring-1 ring-border">
          <p className="font-semibold text-foreground">{t("contacts.policy")}</p>
          <ol className="mt-1 list-decimal space-y-1 ps-5 text-muted-foreground">
            {(
              provider?.policySteps ?? [
                t("contacts.policy1"),
                t("contacts.policy2"),
                t("contacts.policy3"),
                t("contacts.policy4"),
                t("contacts.policy5"),
                t("contacts.policy6"),
              ]
            ).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        {provider && (
          <p
            className={`mt-3 rounded-lg p-3 text-xs leading-relaxed ${provider.mode === "live" && provider.liveReady ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
          >
            {t("contacts.providerMode", {
              mode: provider.mode,
              sms: provider.sms ? t("contacts.configured") : t("contacts.notConfigured"),
              voice: provider.voice ? t("contacts.configured") : t("contacts.notConfigured"),
              email: provider.email ? t("contacts.configured") : t("contacts.notConfigured"),
            })}{" "}
            {provider.mode === "live" && provider.liveReady
              ? t("contacts.providerLive")
              : t("contacts.providerTest")}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("contacts.queueNote")}
        </p>
      </section>

      <AlertHistory />

      {/* Countdown */}
      <section className={`${card} mt-5`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">{t("contacts.countdownHeading")}</h2>
          <span className="font-mono text-3xl font-bold">
            {countdown === 0 ? t("contacts.instant") : `${countdown}s`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t("contacts.countdownBody")}</p>
        <input
          type="range"
          min={0}
          max={60}
          value={countdown}
          aria-label={t("contacts.countdownAria")}
          aria-valuetext={
            countdown === 0
              ? t("contacts.instant")
              : t("contacts.countdownSeconds", { count: countdown })
          }
          onChange={(e) => set({ countdownSeconds: Number(e.target.value) })}
          className="mt-4 w-full accent-destructive"
        />
      </section>

      {/* Thresholds */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center">
          <h2 className="mr-auto font-display text-xl font-bold">{t("contacts.limitsHeading")}</h2>
          <Button
            onClick={() => set({ thresholds: DEFAULT_THRESHOLDS })}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-background"
          >
            <RotateCcw className="size-3.5" /> {t("contacts.reset")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("contacts.limitsBody", { account: userId ? t("contacts.limitsAccount") : "" })}
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-normal text-muted-foreground">
              <th className="pb-2 font-semibold">{t("contacts.colVital")}</th>
              <th className="pb-2 font-semibold">{t("contacts.colUnder")}</th>
              <th className="pb-2 font-semibold">{t("contacts.colOver")}</th>
              <th className="pb-2 font-semibold">{t("contacts.colSecond")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(Object.keys(VITAL_META) as VitalKey[]).map((k) => (
              <tr key={k}>
                <td className="py-2.5 pr-2 font-medium">
                  {VITAL_META[k].label}{" "}
                  <span className="text-xs text-muted-foreground">{VITAL_META[k].unit}</span>
                </td>
                {(["below", "above"] as const).map((f) => (
                  <td key={f} className="py-2.5 pr-2">
                    <input
                      type="number"
                      value={thresholds[k][f] ?? ""}
                      placeholder="—"
                      aria-label={t(
                        f === "below" ? "contacts.lowerLimit" : "contacts.upperLimit",
                        { label: VITAL_META[k].label },
                      )}
                      onChange={(e) => editThreshold(k, f, e.target.value)}
                      className="w-full max-w-20 rounded-lg border border-border px-2 py-1 font-mono"
                    />
                  </td>
                ))}
                <td className="py-2.5 pr-2">
                  {k === "bp" ? (
                    <input
                      type="number"
                      value={thresholds.bp.above2 ?? ""}
                      placeholder="—"
                      aria-label={t("contacts.diastolicLimit")}
                      onChange={(e) => editThreshold("bp", "above2", e.target.value)}
                      className="w-full max-w-20 rounded-lg border border-border px-2 py-1 font-mono"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.values(tErr).some(Boolean) && (
          <p role="alert" className="mt-2 text-xs font-semibold text-critical">
            {t("contacts.rejected", { error: Object.values(tErr).find(Boolean) ?? "" })}
          </p>
        )}
      </section>

      {editing && (
        <ContactForm
          initial={editing === "new" ? null : editing}
          country={country}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function Toggle({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${on ? "bg-success text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border"}`}
    >
      {icon}
      {label}
    </Button>
  );
}

function IconBtn({
  children,
  label,
  ...rest
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
    >
      {children}
    </Button>
  );
}

function ContactForm({
  initial,
  country,
  onClose,
}: {
  initial: Contact | null;
  country: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState<Contact>(
    initial ?? {
      id: `c${Date.now()}`,
      name: "",
      relationship: "Daughter",
      phone: "+91 ",
      call: true,
      sms: true,
      email: "",
      emailAlerts: false,
      confirmedAt: null,
      testDestination: true,
    },
  );
  const [touched, setTouched] = useState(false);
  const phoneOk = isValidPhone(f.phone, country);
  const nameOk = f.name.trim().length > 1;
  const emailOk = !f.emailAlerts || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email ?? "");
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!phoneOk || !nameOk || !emailOk) return;
    set((s) => ({
      contacts: initial ? s.contacts.map((c) => (c.id === f.id ? f : c)) : [...s.contacts, f],
    }));
    onClose();
  };
  const input =
    "mt-1 w-full rounded-lg border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-border";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-secondary/40 p-2  sm:place-items-center"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-title"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center">
          <h3 id="contact-form-title" className="mr-auto font-display text-xl font-bold">
            {initial ? t("contacts.formEdit") : t("contacts.formNew")}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label={t("contacts.formClose")}
            className="grid size-8 place-items-center rounded-full hover:bg-muted"
          >
            <X className="size-4" />
          </Button>
        </div>
        <label className="mt-4 block text-sm font-medium">
          {t("contacts.formName")}
          <input
            aria-label={t("contacts.formName")}
            aria-invalid={touched && !nameOk}
            aria-describedby={touched && !nameOk ? "contact-name-error" : undefined}
            className={input}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          {touched && !nameOk && (
            <span id="contact-name-error" role="alert" className="text-xs text-critical">
              {t("contacts.formNameError")}
            </span>
          )}
        </label>
        <label className="mt-3 block text-sm font-medium">
          {t("contacts.formRelationship")}
          <select
            className={input}
            value={f.relationship}
            onChange={(e) => setF({ ...f, relationship: e.target.value })}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          {t("contacts.formPhone")}
          <input
            aria-label={t("contacts.formPhone")}
            aria-invalid={touched && !phoneOk}
            aria-describedby={touched && !phoneOk ? "contact-phone-error" : undefined}
            className={`${input} font-mono`}
            inputMode="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
          {touched && !phoneOk && (
            <span id="contact-phone-error" role="alert" className="text-xs text-critical">
              {t("contacts.formPhoneError")}
            </span>
          )}
        </label>
        <label className="mt-3 block text-sm font-medium">
          {t("contacts.formEmail")}
          <input
            aria-label={t("contacts.formEmail")}
            aria-invalid={touched && !emailOk}
            className={input}
            inputMode="email"
            autoComplete="off"
            value={f.email ?? ""}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          {touched && !emailOk && (
            <span role="alert" className="text-xs text-critical">
              {t("contacts.formEmailError")}
            </span>
          )}
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Toggle
            on={f.call}
            onClick={() => setF({ ...f, call: !f.call })}
            icon={<Phone className="size-3.5" />}
            label={t("contacts.channelCall")}
          />
          <Toggle
            on={f.sms}
            onClick={() => setF({ ...f, sms: !f.sms })}
            icon={<MessageSquare className="size-3.5" />}
            label={t("contacts.channelSms")}
          />
          <Toggle
            on={Boolean(f.emailAlerts)}
            onClick={() => setF({ ...f, emailAlerts: !f.emailAlerts })}
            icon={<Mail className="size-3.5" />}
            label={t("contacts.channelEmail")}
          />
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-lg bg-background p-3 text-sm ring-1 ring-border">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0"
            checked={Boolean(f.confirmedAt)}
            onChange={(e) => setF({ ...f, confirmedAt: e.target.checked ? Date.now() : null })}
          />
          <span>
            <span className="block font-medium">{t("contacts.formConfirm")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("contacts.formConfirmBody")}
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 rounded-lg bg-background p-3 text-sm ring-1 ring-border">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0"
            checked={f.testDestination !== false}
            onChange={(e) => setF({ ...f, testDestination: e.target.checked })}
          />
          <span>
            <span className="block font-medium">{t("contacts.formTest")}</span>
            <span className="block text-xs text-muted-foreground">
              {t("contacts.formTestBody")}
            </span>
          </span>
        </label>
        <Button className="mt-6 w-full rounded-lg bg-secondary py-3 font-bold text-foreground">
          {t("contacts.formSave")}
        </Button>
      </form>
    </div>
  );
}
