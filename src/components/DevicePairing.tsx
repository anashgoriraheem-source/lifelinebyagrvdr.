import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bluetooth, BluetoothOff, LoaderCircle, ShieldCheck, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import {
  MAX_RECOVERY_ATTEMPTS,
  bluetoothSupported,
  disconnectWearable,
  pairWearable,
  reconnectWearable,
  type PairMode,
} from "@/core/ble/connect";
import { NO_MEASUREMENT_MS, connectionPhase, waitingWithoutMeasurement } from "@/core/ble/support";

/**
 * Guided Bluetooth pairing.
 *
 * Written for a first-time user: prerequisites in everyday words, one clearly
 * named action, a plain-language status that is announced to screen readers,
 * and a distinct message for cancellation, blocked permission, an unsupported
 * browser, an insecure page, an unavailable device, a device that connected but
 * exposes no supported service, and a device that connected without sending a
 * measurement. "Connected" is never shown as "monitoring".
 */
export function DevicePairing() {
  const { t, locale, formatTime } = useI18n();
  const device = useApp((s) => s.device);
  const vitals = useApp((s) => s.vitals);
  const now = useNow();
  const [caps, setCaps] = useState<{ supported: boolean; secure: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    setCaps({ supported: bluetoothSupported(), secure: window.isSecureContext !== false });
  }, []);

  // A successful connection clears an older local error message.
  useEffect(() => {
    if (device.status === "connected") setNotice(null);
  }, [device.status]);

  const phase = connectionPhase({ device, vitals, now, supported: caps?.supported ?? true });
  const name = device.name ?? (locale === "hi" ? "डिवाइस" : "device");
  const canConnect = Boolean(caps?.supported && caps.secure);
  const waited = device.connectedAt == null ? 0 : Math.max(0, now - device.connectedAt);
  const waitingTooLong = waitingWithoutMeasurement(device, vitals, now, NO_MEASUREMENT_MS);

  const describe = (error: unknown) => {
    const errorName = (error as { name?: string } | undefined)?.name ?? "";
    if (errorName === "NotFoundError") return t("device.connect.cancelled");
    if (errorName === "NotAllowedError") return t("device.connect.denied");
    if (errorName === "SecurityError")
      return t(caps?.secure ? "device.connect.denied" : "device.connect.insecure");
    if (errorName === "UnsupportedServicesError")
      return t("device.connect.unsupportedServices", { name });
    if (errorName === "IncompatibleDeviceError") return t("device.connect.incompatible");
    if (errorName === "NetworkError") return t("device.connect.rangeError");
    if (errorName === "InvalidStateError" || errorName === "NotSupportedError")
      return t("device.connect.failed");
    return t("device.connect.failed");
  };

  const run = async (action: () => Promise<void>) => {
    setNotice(null);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  };

  const start = (mode: PairMode) => run(() => pairWearable(mode));
  const again = () => run(() => reconnectWearable());

  const statusText = (() => {
    if (busy && device.status !== "connecting") return t("device.connect.statusOpening");
    if (device.error === "invalid-reading") return t("device.connect.invalidReading");
    if (device.error === "no-contact") return t("device.connect.noContact", { name });
    if (device.error === "unsupported-services")
      return t("device.connect.unsupportedServices", { name });
    if (device.error === "recovery-stopped") return t("device.connect.recoveryStopped", { name });
    if (notice) return notice.text;
    if (device.status === "reconnecting")
      return t("device.connect.statusReconnecting", {
        name,
        attempt: device.recoveryAttempt ?? 1,
        total: MAX_RECOVERY_ATTEMPTS,
      });
    if (device.status === "connecting") return t("device.connect.statusConnecting", { name });
    if (phase === "receiving") return t("device.connect.statusReceiving", { name });
    if (phase === "stale") return t("device.connect.statusStale", { name });
    if (phase === "connected") return t("device.connect.statusConnected", { name });
    if (device.status === "disconnected") return t("device.connect.statusLost", { name });
    if (device.status === "error") return t("device.connect.failed");
    return t("device.connect.statusIdle");
  })();

  const busyState = busy || device.status === "connecting" || device.status === "reconnecting";
  const connected = device.status === "connected";

  return (
    <section
      aria-labelledby="device-connect-title"
      className="mt-5 rounded-lg bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg border border-border text-primary">
          <Bluetooth className="size-5" aria-hidden="true" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 id="device-connect-title" className="font-display text-lg font-semibold sm:text-xl">
            {t("device.connect.title")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.intro")}
          </p>
        </div>
      </div>

      {/* Connection state: icon plus words, never colour alone. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
          notice?.tone === "error" || device.status === "error"
            ? "bg-critical-soft text-foreground"
            : "bg-secondary text-foreground"
        }`}
      >
        {busyState ? (
          <LoaderCircle
            className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
            aria-hidden="true"
          />
        ) : phase === "receiving" ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        ) : phase === "connected" ? (
          <TimerReset className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        ) : (
          <BluetoothOff
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span>{statusText}</span>
      </p>

      {/* Timestamped provenance: what arrived, when, and how much of it. */}
      {connected || phase === "stale" ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="device-last-reading">
          {device.lastReadingAt
            ? t("device.connect.lastReading", {
                time: formatTime(device.lastReadingAt),
                count: device.readingCount ?? 0,
              })
            : t("device.connect.noReadingsYet")}
        </p>
      ) : null}

      {caps === null ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !caps.secure ? (
        <p className="mt-4 text-sm leading-relaxed">{t("device.connect.insecure")}</p>
      ) : !caps.supported ? (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.unsupported")}
          </p>
        </div>
      ) : connected || phase === "stale" ? (
        <div className="mt-4 space-y-3">
          {waitingTooLong ? (
            <p className="rounded-lg bg-secondary px-3 py-2 text-sm leading-relaxed">
              {t("device.connect.noMeasurementYet", { seconds: Math.round(waited / 1000) })}
            </p>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("device.connect.servicesHeading")}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {device.vitals.map((k) => (
                <li key={k}>{t(`reading.${k}`)}</li>
              ))}
            </ul>
            {device.missing?.length ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("device.connect.notProvided", {
                  readings: device.missing.map((k) => t(`reading.${k}`)).join(", "),
                })}
              </p>
            ) : null}
            {/* A service the device has but will not send from is a failure worth
                naming: silence here is what "connected but no readings" looks like. */}
            {device.issues?.length ? (
              <ul className="mt-3 space-y-1.5 rounded-lg bg-warning-soft px-3 py-2 text-sm leading-relaxed text-foreground">
                {device.issues.map((issue) => (
                  <li key={`${issue.key}-${issue.reason}`}>
                    {t(
                      issue.reason === "notifications-failed"
                        ? "device.connect.issueNotifications"
                        : "device.connect.issueCharacteristic",
                      { reading: t(`reading.${issue.key}`), name },
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {waitingTooLong || phase === "stale" ? (
              <>
                <Button onClick={again} disabled={busyState} className="min-h-12 rounded-full px-5">
                  <Bluetooth aria-hidden="true" />
                  {t("device.connect.reconnect")}
                </Button>
                <Button variant="outline" onClick={() => start("standard")} disabled={busyState}>
                  {t("device.connect.action")}
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={disconnectWearable} className="min-h-11">
              {t("device.connect.disconnect")}
            </Button>
          </div>
        </div>
      ) : device.status === "disconnected" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={again} disabled={busyState} className="min-h-12 rounded-full px-5">
            <Bluetooth aria-hidden="true" />
            {t("device.connect.reconnect")}
          </Button>
          <Button variant="outline" onClick={() => start("standard")} disabled={busyState}>
            {t("device.connect.action")}
          </Button>
        </div>
      ) : skipped ? (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.skipped")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/assistant">{t("device.connect.firstAid")}</Link>
            </Button>
            <Button variant="ghost" onClick={() => setSkipped(false)} className="min-h-11">
              {t("device.connect.showSteps")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {t("device.connect.ready")}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            {t("device.connect.stepsHeading")}
          </h3>
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-sm leading-relaxed text-muted-foreground">
            <li>{t("device.connect.step1")}</li>
            <li>{t("device.connect.step2")}</li>
            <li>{t("device.connect.step3")}</li>
            <li>{t("device.connect.step4")}</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => start("standard")}
              disabled={busyState || !canConnect}
              className="min-h-12 rounded-full px-5 font-semibold"
            >
              <Bluetooth aria-hidden="true" />
              {t("device.connect.action")}
            </Button>
            <Button
              variant="outline"
              onClick={() => start("any")}
              disabled={busyState || !canConnect}
            >
              {t("device.connect.findAny")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSkipped(true)}
              className="min-h-11 text-muted-foreground"
            >
              {t("device.connect.without")}
            </Button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.actionHint")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.findAnyHint")}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/assistant">{t("device.connect.firstAid")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/contacts">{t("device.connect.without")}</Link>
        </Button>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">{t("device.connect.limitsTitle")}</h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("device.connect.limitReadings")}</li>
          <li>{t("device.connect.limitManual")}</li>
          <li>{t("device.connect.limitBackground")}</li>
        </ul>
      </div>

      <details className="mt-3 border-t border-border pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-foreground">
          {t("device.connect.technicalTitle")}
        </summary>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("device.connect.technicalBody")}
        </p>
      </details>
    </section>
  );
}
