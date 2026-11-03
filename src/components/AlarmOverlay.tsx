import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { appStore, cancelAlarm, openAlarmActions, emergencyNumbers, set } from "@/lib/store";
import { EMERGENCY_BY_COUNTRY } from "@/lib/fixtures";
import { smsHref, telHref, mapsLink, STALE_FIX_MS } from "@/lib/sos";
import { Button } from "@/components/ui/button";
import { cancelDispatch } from "@/lib/dispatch.functions";
import { INCIDENT_STATUS_LABEL } from "@/lib/alertTypes";
import type { AlarmReason } from "@/lib/types";

/** Which sensor (or person) opened this alarm, said plainly. */
const ALARM_SOURCE: Record<AlarmReason["type"], string> = {
  sos: "the SOS button / SOS बटन",
  vital: "a device reading outside your limits / सीमा से बाहर रीडिंग",
  fall: "the fall detector / गिरने का पता लगाना",
  jolt: "a possible impact on the motion sensor / संभावित टक्कर",
  stillness: "60 seconds without movement on the motion sensor / 60 सेकंड बिना हलचल",
};
const SENSOR_SOURCES = new Set<AlarmReason["type"]>(["fall", "jolt", "stillness"]);
/** Focus-trapped, ordinary click/keyboard controls. Automatic alerts are
 * created by AlertRecorder from the settings the person saved; this screen only
 * reports their stored state and offers a cancel during the countdown. It never
 * claims a call or message succeeded on its own.
 * Share switches reset on every new incident and default to no private data.
 */
export function AlarmOverlay() {
  const returnFocus = useRef<HTMLElement | null>(null);
  const alarm = useApp((s) => s.alarm);
  const country = useApp((s) => s.countryCode);
  const contacts = useApp((s) => s.contacts);
  const fix = useApp((s) => s.location.fix);
  const profile = useApp((s) => s.profile);
  const { t, formatNumber, formatDateTime, locale } = useI18n();
  const now = useNow(250);
  const [shareLocation, setShareLocation] = useState(false);
  const [shareMedical, setShareMedical] = useState(false);
  const [selected, setSelected] = useState(false);
  const dispatch = useApp((s) => s.dispatch);
  const cancelAlert = useServerFn(cancelDispatch);
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    setShareLocation(false);
    setShareMedical(false);
    setSelected(false);
  }, [alarm.startedAt]);
  const remaining =
    alarm.startedAt === null
      ? 0
      : Math.max(
          0,
          Math.ceil((appStore.state.countdownSeconds * 1000 - (now - alarm.startedAt)) / 1000),
        );
  useEffect(() => {
    if (alarm.phase === "countdown" && remaining === 0) openAlarmActions();
  }, [alarm.phase, remaining]);
  const n = useApp(emergencyNumbers);
  const stale = Boolean(fix && now - fix.at > STALE_FIX_MS);
  const msg = [
    t("release.draftBody"),
    shareLocation && fix
      ? `${mapsLink(fix)} (±${Math.round(fix.accuracy)} m; ${formatDateTime(fix.at)}${stale ? " — OUT OF DATE / पुराना" : ""})`
      : null,
    shareMedical
      ? `${profile.name}\n${profile.age ?? "—"}\n${profile.bloodType}\n${profile.conditions.join(", ")}\n${profile.allergies.join(", ")}\n${profile.medications.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const clear = () => {
    cancelAlarm("User closed options; no delivery status inferred");
    set({ assistantOpen: false });
  };
  const countryNames =
    locale === "hi"
      ? {
          IN: "भारत",
          US: "संयुक्त राज्य",
          GB: "यूनाइटेड किंगडम",
          EU: "यूरोपीय संघ",
          AU: "ऑस्ट्रेलिया",
        }
      : null;
  const linkClass =
    "flex min-h-12 items-center rounded-lg border border-border px-4 py-3 font-semibold text-primary underline underline-offset-4";
  return (
    <Dialog.Root
      open={alarm.phase !== "idle"}
      onOpenChange={(open) => {
        if (!open) clear();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-background/90" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
          aria-describedby="emergency-description"
          className="fixed inset-2 z-[100] overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-xl sm:inset-x-[max(1rem,calc((100vw-48rem)/2))] sm:p-6"
        >
          <Dialog.Title className="font-display text-2xl font-bold">
            {t(alarm.demo ? "release.demoTitle" : "release.alarmTitle")}
          </Dialog.Title>
          <Dialog.Description id="emergency-description" className="mt-3 text-sm">
            {t("release.urgent")}
          </Dialog.Description>
          <p
            className="mt-3 rounded-lg border border-border p-3 text-sm"
            data-alarm-source={alarm.reason?.type ?? "none"}
          >
            <span className="font-semibold">This alarm came from </span>
            {alarm.reason ? ALARM_SOURCE[alarm.reason.type] : "an unknown source"} —{" "}
            {alarm.reason?.label}
            {alarm.reason?.reading ? ` · ${alarm.reason.reading}` : ""}
            {alarm.reason && SENSOR_SOURCES.has(alarm.reason.type) && (
              <span className="mt-2 block text-xs text-muted-foreground">
                A sensor pattern is not proof that someone is unconscious or injured. If you can
                respond, choose “I’m OK — cancel the automatic alert” while the countdown runs.
              </span>
            )}
          </p>
          <p className="mt-3 rounded-lg bg-critical-soft p-3 text-sm">{t("release.nearby")}</p>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 rounded-lg border border-border p-3"
          >
            {dispatch
              ? `Automatic alert: ${INCIDENT_STATUS_LABEL[dispatch.incidentStatus] ?? dispatch.incidentStatus}. Lifeline has not placed a public emergency call.`
              : t(selected ? "release.linkSelected" : "release.notSent")}
          </p>
          {alarm.phase === "countdown" && (
            <div className="mt-4">
              <p>{t("release.countdown", { count: formatNumber(remaining) })}</p>
              <Button className="mt-3" onClick={openAlarmActions}>
                {t("release.openNow")}
              </Button>
              <Button
                variant="outline"
                className="mt-2 min-h-11 w-full"
                onClick={() => {
                  cancelAlarm("Acknowledged — the person says they are OK");
                  set({ assistantOpen: false });
                }}
              >
                I’m OK — cancel the automatic alert / ठीक हूँ — अलर्ट रद्द करें
              </Button>
            </div>
          )}
          {dispatch && (
            <div className="mt-4 rounded-lg border border-border p-3 text-sm">
              <p role="status" aria-live="polite">
                <strong>Automatic alert:</strong>{" "}
                {INCIDENT_STATUS_LABEL[dispatch.incidentStatus] ?? dispatch.incidentStatus}
                {dispatch.mode === "test" ? " · test mode, no real contact is messaged" : ""}
              </p>
              {dispatch.incidentStatus === "countdown" && (
                <Button
                  variant="outline"
                  className="mt-2 min-h-11"
                  disabled={stopping}
                  onClick={async () => {
                    setStopping(true);
                    try {
                      set({ dispatch: await cancelAlert({ data: { eventId: dispatch.eventId, reason: "Canceled from the alarm screen" } }) });
                    } catch {
                      setStopping(false);
                    }
                  }}
                >
                  Cancel automatic alert
                </Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery status is on the alert panel. An answered call is not an acknowledgement;
                only a contact pressing 1 is.
              </p>
            </div>
          )}
          <label htmlFor="emergency-country" className="mt-5 block text-sm font-semibold">
            {t("release.country")}
          </label>
          <select
            id="emergency-country"
            value={country}
            onChange={(e) => set({ countryCode: e.target.value })}
            className="mt-2 min-h-12 w-full rounded-lg border border-border p-2"
          >
            {Object.entries(EMERGENCY_BY_COUNTRY).map(([code, v]) => (
              <option key={code} value={code}>
                {countryNames?.[code as keyof typeof countryNames] ?? v.country}
              </option>
            ))}
          </select>
          <div className="mt-3">
            {alarm.demo ? (
              <Button disabled className="w-full">
                {t("release.call", { number: n.general })}
              </Button>
            ) : n.general ? (
              <a className={linkClass} href={telHref(n.general)} onClick={() => setSelected(true)}>
                {t("release.call", { number: n.general })}
              </a>
            ) : (
              <p>{t("release.noDelivery")}</p>
            )}
          </div>
          <section className="mt-6 border-t border-border pt-4">
            <h2 className="text-lg font-bold">{t("nav.contacts")}</h2>
            {!contacts.length && <p className="mt-3 text-sm">{t("release.noContacts")}</p>}
            <ul className="mt-3 space-y-3">
              {contacts.map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <p className="font-semibold break-words">{c.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.call &&
                      (alarm.demo ? (
                        <Button disabled>{t("release.callContact", { name: c.name })}</Button>
                      ) : (
                        <a
                          className={linkClass}
                          href={telHref(c.phone)}
                          onClick={() => setSelected(true)}
                        >
                          {t("release.callContact", { name: c.name })}
                        </a>
                      ))}
                    {c.sms &&
                      (alarm.demo ? (
                        <Button disabled>{t("release.draft", { name: c.name })}</Button>
                      ) : (
                        <a
                          className={linkClass}
                          href={smsHref([c.phone], msg)}
                          onClick={() => setSelected(true)}
                        >
                          {t("release.draft", { name: c.name })}
                        </a>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-5 space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-lg font-bold">{t("release.message")}</h2>
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                checked={shareLocation}
                disabled={!fix}
                onChange={(e) => setShareLocation(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              {t("release.shareLocation")}
            </label>
            {!fix && <p className="text-sm">{t("release.noLocation")}</p>}
            {stale && <p className="text-sm text-warning">{t("release.oldLocation")}</p>}
            <label className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                checked={shareMedical}
                onChange={(e) => setShareMedical(e.target.checked)}
                className="mt-1 size-5 shrink-0"
              />
              {t("release.shareMedical")}
            </label>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-card p-3 text-sm">{msg}</p>
            <p className="text-sm text-muted-foreground">{t("release.privacyNote")}</p>
          </section>
          <p className="mt-5 text-sm">{t("release.noDelivery")}</p>
          <Dialog.Close asChild>
            <Button variant="outline" className="mt-5">
              {t("release.dismiss")}
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
