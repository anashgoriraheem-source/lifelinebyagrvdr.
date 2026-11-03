import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getAlertSetup } from "@/lib/dispatch.functions";
import type { AlertSetupView } from "@/lib/alertTypes";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { isStale } from "@/lib/detection";
import { AlertStatusPanel } from "@/components/AlertStatusPanel";
import { Button } from "@/components/ui/button";
import { BellRing, CircleAlert, CircleCheck } from "lucide-react";

/**
 * "Can Lifeline alert someone right now?" Facts only: the automation opt-in, the
 * provider state, the device link and the age of the last real reading. Nothing
 * here claims background or unconscious-person protection.
 */
export function AutomaticAlertStatus() {
  const load = useServerFn(getAlertSetup);
  const userId = useApp((s) => s.userId);
  const device = useApp((s) => s.device);
  const vitals = useApp((s) => s.vitals);
  const dispatch = useApp((s) => s.dispatch);
  const now = useNow();
  const [setup, setSetup] = useState<AlertSetupView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSetup(null);
      return;
    }
    let active = true;
    load()
      .then((v) => {
        if (active) setSetup(v);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [load, userId]);

  const fresh = Object.entries(vitals).some(
    ([k, r]) => r && !isStale(k as keyof typeof vitals, r, now),
  );
  const automationOn = Boolean(setup?.settings?.automationEnabled);
  const providerReady = Boolean(setup?.provider.liveReady);
  const deviceLinked = device.status === "connected";

  return (
    <section aria-labelledby="auto-alert-title" className="mt-8 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="auto-alert-title" className="font-display text-xl font-bold">
          Automatic alerts
        </h2>
        <Link to="/alerts" className="ms-auto">
          <Button variant="outline" className="min-h-11">
            <BellRing className="size-4" aria-hidden="true" />
            {automationOn ? "Alert setup" : "Set up automatic alerts"}
          </Button>
        </Link>
      </div>

      {!userId ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in on the Account page to configure automatic alerts. Manual call and message
          buttons stay available without an account.
        </p>
      ) : failed ? (
        <p role="alert" className="mt-3 text-sm text-critical">
          The automatic alert setup could not be loaded. Try again from the alert setup page.
        </p>
      ) : !setup ? (
        <p className="mt-3 text-sm text-muted-foreground">Checking alert setup…</p>
      ) : (
        <>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              {automationOn ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span>
                <strong>{automationOn ? "Automatic alerts are on" : "Automatic alerts are off"}</strong>
                {automationOn
                  ? ` · ${setup.settings?.testMode ? "test mode — no real contact is messaged" : "live mode"}`
                  : " · nothing is sent automatically"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              {providerReady ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span>
                <strong>{providerReady ? "Messaging provider configured" : "Messaging provider not configured"}</strong>
                {providerReady
                  ? " · calls and texts can be dispatched by the server"
                  : " · setup steps are listed on the alert setup page"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              {deviceLinked && fresh ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <span>
                <strong>
                  {deviceLinked
                    ? fresh
                      ? "Device connected and sending readings"
                      : "Device connected — waiting for a reading"
                    : "No device connected"}
                </strong>
                {device.lastReadingAt
                  ? ` · last reading ${new Date(device.lastReadingAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : " · sensor alarms cannot fire without a real reading"}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Lifeline can only create an alert while this page or another Lifeline tab is open and
            the device is connected. If the browser is closed, or the page is suspended, no alarm
            can be raised — this is not background monitoring.
          </p>
          {dispatch && <div className="mt-4">
            <AlertStatusPanel eventId={dispatch.eventId} initial={dispatch} />
          </div>}
        </>
      )}
    </section>
  );
}
