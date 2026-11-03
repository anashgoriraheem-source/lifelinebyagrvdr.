import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bluetooth, BluetoothOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { VITAL_META, isStale } from "@/lib/detection";
import type { VitalKey } from "@/lib/types";
import { bluetoothSupported, disconnectWearable, pairWearable } from "@/core/ble/connect";

const VITAL_KEYS: VitalKey[] = ["hr", "spo2", "bp", "glucose"];

/**
 * Guided Bluetooth pairing.
 *
 * Written for a first-time user: prerequisites in everyday words, one clearly
 * named action, a plain-language status that is announced to screen readers,
 * and a distinct message for cancellation, blocked permission, an unsupported
 * browser, an insecure page, an unavailable device and an incompatible device.
 * Device errors are translated here, never shown as browser exceptions.
 */
export function DevicePairing() {
  const { t, locale } = useI18n();
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

  // A successful connection clears an older error message.
  useEffect(() => {
    if (device.status === "connected") setNotice(null);
  }, [device.status]);

  const receiving =
    device.status === "connected" &&
    VITAL_KEYS.some((k) => vitals[k] && !isStale(k, vitals[k], now));
  const name = device.name ?? (locale === "hi" ? "डिवाइस" : "device");
  const canConnect = Boolean(caps?.supported && caps.secure);

  const describe = (error: unknown) => {
    const err = error as (Error & { name?: string }) | undefined;
    const errorName = err?.name ?? "";
    if (errorName === "NotFoundError") return t("device.connect.cancelled");
    if (errorName === "NotAllowedError") return t("device.connect.denied");
    if (errorName === "SecurityError")
      return t(caps?.secure ? "device.connect.denied" : "device.connect.insecure");
    if (errorName === "IncompatibleDeviceError") return t("device.connect.incompatible");
    if (errorName === "NetworkError") return t("device.connect.rangeError");
    if (errorName === "InvalidStateError" || errorName === "NotSupportedError")
      return t("device.connect.failed");
    const message = err?.message ?? "";
    if (message.includes("does not share")) return t("device.connect.incompatible");
    if (message.includes("Bluetooth is not available")) return t("device.connect.unsupported");
    return t("device.connect.failed");
  };

  const start = async () => {
    setNotice(null);
    setBusy(true);
    try {
      await pairWearable();
    } catch (error) {
      setNotice({ tone: "error", text: describe(error) });
    } finally {
      setBusy(false);
    }
  };

  const statusText = (() => {
    if (busy && device.status !== "connecting") return t("device.connect.statusOpening");
    if (device.error === "invalid-reading") return t("device.connect.invalidReading");
    if (notice) return notice.text;
    if (device.status === "connecting") return t("device.connect.statusConnecting", { name });
    if (device.status === "connected")
      return receiving
        ? t("device.connect.statusReceiving", { name })
        : t("device.connect.statusConnected", { name });
    if (device.status === "reconnecting" || device.status === "disconnected")
      return t("device.connect.statusLost", { name });
    if (device.status === "error") return t("device.connect.failed");
    return t("device.connect.statusIdle");
  })();

  const busyState = busy || device.status === "connecting";
  const connected = device.status === "connected" || device.status === "reconnecting";

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
        ) : device.status === "connected" ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <BluetoothOff
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <span>{statusText}</span>
      </p>

      {caps === null ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !caps.secure ? (
        <p className="mt-4 text-sm">{t("device.connect.insecure")}</p>
      ) : !caps.supported ? (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("device.connect.unsupported")}
          </p>
        </div>
      ) : !caps.secure ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("device.connect.insecure")}
        </p>
      ) : connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {device.vitals.map((k) => (
              <li key={k}>{t(`reading.${k}`)}</li>
            ))}
          </ul>
          <Button variant="outline" onClick={disconnectWearable} className="min-h-11">
            {t("device.connect.disconnect")}
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
              onClick={start}
              disabled={busyState || !canConnect}
              className="min-h-12 rounded-full px-5 font-semibold"
            >
              <Bluetooth aria-hidden="true" />
              {t("device.connect.action")}
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
