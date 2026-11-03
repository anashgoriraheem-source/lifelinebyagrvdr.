import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  getAlertSetup,
  saveAlertSettings,
  startTestAlert,
} from "@/lib/dispatch.functions";
import { saveSafetyContacts } from "@/lib/account.functions";
import { alertCallScript, alertSmsBody } from "@/lib/alertMessage";
import {
  INCIDENT_STATUS_LABEL,
  type AlertSetupView,
  type DispatchView,
} from "@/lib/alertTypes";
import { AlertStatusPanel } from "@/components/AlertStatusPanel";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import {
  AlertTriangle,
  BellRing,
  CircleCheck,
  FlaskConical,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/alerts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Automatic alerts · Lifeline" },
      {
        name: "description",
        content:
          "Choose which contacts Lifeline may text and call automatically, and which alarms trigger them.",
      },
    ],
  }),
  component: AutomaticAlerts,
});

const section = "mt-8 border-t border-border pt-6";
const label = "block text-sm font-semibold";

const TRIGGERS: { key: string; title: string; help: string }[] = [
  { key: "sos", title: "SOS button", help: "Sends immediately. There is no cancellation window." },
  { key: "vital", title: "Vital-sign alarm", help: "Uses a real device reading outside your limits." },
  { key: "fall", title: "Fall detected", help: "Only while the device is connected and the page is open." },
  { key: "jolt", title: "Sudden impact", help: "Uses the phone motion detector in this browser." },
  {
    key: "stillness",
    title: "Stillness detected",
    help: "Raises an alarm after 60 seconds of confirmed stillness, while movement monitoring is on.",
  },
];

function AutomaticAlerts() {
  const userId = useApp((s) => s.userId);
  const fix = useApp((s) => s.location.fix);
  const load = useServerFn(getAlertSetup);
  const saveSettings = useServerFn(saveAlertSettings);
  const saveContacts = useServerFn(saveSafetyContacts);
  const testAlert = useServerFn(startTestAlert);

  const [setup, setSetup] = useState<AlertSetupView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testView, setTestView] = useState<DispatchView | null>(null);

  const [identityName, setIdentityName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [triggers, setTriggers] = useState<string[]>(["sos"]);
  const [countdown, setCountdown] = useState(15);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [escalateAfter, setEscalateAfter] = useState(45);
  const [maxRounds, setMaxRounds] = useState(2);

  const apply = useCallback((view: AlertSetupView) => {
    setSetup(view);
    const s = view.settings;
    setIdentityName(s?.identityName ?? "");
    setEnabled(Boolean(s?.automationEnabled));
    setConsent(Boolean(s?.consentAt));
    setTestMode(s ? s.testMode : true);
    setTriggers(s?.triggers ?? ["sos"]);
    setCountdown(s?.countdownSeconds ?? 15);
    setIncludeLocation(s ? s.includeLocation : true);
    setEscalateAfter(s?.escalateAfterSeconds ?? 45);
    setMaxRounds(s?.maxRounds ?? 2);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    load()
      .then((view) => {
        if (active) apply(view);
      })
      .catch(() => {
        if (active) setLoadError("Your alert setup could not be loaded. Try again.");
      });
    return () => {
      active = false;
    };
  }, [apply, load, userId]);

  const setConsentFor = (id: string, next: boolean) => {
    setSetup((current) =>
      current
        ? {
            ...current,
            contacts: current.contacts.map((c) =>
              c.id === id
                ? {
                    ...c,
                    automationConsent: next,
                    consentAt: next ? new Date().toISOString() : null,
                    consentNote: next ? "Consent confirmed in Lifeline" : "",
                  }
                : c,
            ),
          }
        : current,
    );
  };

  const setChannel = (id: string, channel: "sms" | "call", next: boolean) => {
    setSetup((current) =>
      current
        ? {
            ...current,
            contacts: current.contacts.map((c) =>
              c.id === id ? { ...c, [channel]: next } : c,
            ),
          }
        : current,
    );
  };

  const submit = async () => {
    if (!setup) return;
    setSaving(true);
    setMessage("");
    setSaveError("");
    try {
      await saveContacts({
        data: setup.contacts.map((c) => ({
          name: c.name,
          phone: c.phone.replace(/[^\d+]/g, ""),
          relationship: c.relationship,
          call: c.call,
          sms: c.sms,
          email: c.email,
          emailAlerts: c.emailAlerts,
          confirmedAt: c.confirmedAt ? Date.parse(c.confirmedAt) : null,
          testDestination: c.testDestination,
          automationConsent: c.automationConsent,
          consentAt: c.consentAt ? Date.parse(c.consentAt) : null,
          consentNote: c.consentNote,
        })),
      });
      await saveSettings({
        data: {
          identityName,
          automationEnabled: enabled,
          testMode,
          triggers: triggers as ("sos" | "vital" | "fall" | "jolt" | "stillness")[],
          countdownSeconds: countdown,
          includeLocation,
          escalateAfterSeconds: escalateAfter,
          maxRounds,
          consent,
        },
      });
      setMessage("Saved. Lifeline will use these settings for the next qualifying alarm.");
      apply(await load());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your alert setup was not saved.");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestView(null);
    setSaveError("");
    try {
      setTestView(await testAlert());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The test alert could not be started.");
    } finally {
      setTesting(false);
    }
  };

  if (!userId) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
        <h1 className="font-display text-4xl font-extrabold">Automatic alerts</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Automatic texts and calls need an account so the server can verify who is asking and keep
          an audit trail. Manual call and message buttons work without signing in.
        </p>
        <Link to="/account" className="mt-6 inline-block">
          <Button className="min-h-12">Sign in or create an account</Button>
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
        <h1 className="font-display text-4xl font-extrabold">Automatic alerts</h1>
        <p role="alert" className="mt-4 text-critical">
          {loadError}
        </p>
      </main>
    );
  }

  if (!setup) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
        <h1 className="font-display text-4xl font-extrabold">Automatic alerts</h1>
        <p role="status" className="mt-4 text-muted-foreground">
          Loading your alert setup…
        </p>
      </main>
    );
  }

  const consented = setup.contacts.filter((c) => c.automationConsent);
  const previewInput = {
    identity: identityName,
    triggerLabel: "SOS button",
    startedAt: Date.now(),
    location: fix
      ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, at: fix.at }
      : null,
    includeLocation,
    testMode,
  };
  const provider = setup.provider;

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
      <h1 className="font-display text-4xl font-extrabold">Automatic alerts</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        When a qualifying alarm starts, Lifeline texts and calls your chosen contacts from the
        server without waiting for you to press send. Calls and texts only go out while automatic
        alerts are on and the alarm source can actually run.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="flex items-start gap-2 text-sm">
          {provider.liveReady ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          )}
          <span>
            <strong>
              {provider.liveReady
                ? "Messaging provider configured"
                : "Messaging provider not configured"}
            </strong>{" "}
            · {provider.liveReady
              ? "A real SMS and voice provider is connected through server-side credentials."
              : "Test mode records what would be sent. Live alerts stay unavailable until the provider is configured."}
          </span>
        </p>
        {!provider.liveReady && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {provider.missing.map((m) => (
              <li key={m}>Missing: {m}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Test destination:{" "}
          {provider.testDestinationConfigured
            ? "one number is designated for tests; test mode can never reach your contacts."
            : "none designated, so test mode only records the attempt and sends nothing."}
        </p>
      </div>

      <section className={section} aria-labelledby="contacts-heading">
        <h2 id="contacts-heading" className="font-display text-xl font-bold">
          1. Contacts and their consent
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each contact must agree to receive automated alerts. Consent is recorded with a time; a
          phone number alone is never treated as consent.
        </p>
        {setup.contacts.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm">
            No contacts yet. Add them on the{" "}
            <Link to="/contacts" className="text-primary underline">
              Contacts page
            </Link>
            , then return here to record consent.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {setup.contacts.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <span className="text-sm text-muted-foreground">{c.phone}</span>
                  {c.automationConsent ? (
                    <span className="ms-auto rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-primary">
                      Consented
                    </span>
                  ) : (
                    <span className="ms-auto rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                      No consent
                    </span>
                  )}
                </div>
                <label className="mt-3 flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-5"
                    checked={c.automationConsent}
                    onChange={(e) => setConsentFor(c.id, e.target.checked)}
                  />
                  <span>
                    This contact agreed to receive automated Lifeline texts and calls for my
                    emergencies.
                  </span>
                </label>
                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={c.sms}
                      onChange={(e) => setChannel(c.id, "sms", e.target.checked)}
                    />
                    <MessageSquare className="size-4" aria-hidden="true" /> Text message
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={c.call}
                      onChange={(e) => setChannel(c.id, "call", e.target.checked)}
                    />
                    <Phone className="size-4" aria-hidden="true" /> Automated call
                  </label>
                </div>
                {c.consentAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Consent recorded {new Date(c.consentAt).toLocaleString()}. Remove consent any
                    time with the checkbox above.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={section} aria-labelledby="triggers-heading">
        <h2 id="triggers-heading" className="font-display text-xl font-bold">
          2. Which alarms send alerts
        </h2>
        <ul className="mt-3 space-y-2">
          {TRIGGERS.map((t) => (
            <li key={t.key} className="rounded-lg border border-border p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={triggers.includes(t.key)}
                  onChange={(e) =>
                    setTriggers((current) =>
                      e.target.checked
                        ? [...current, t.key]
                        : current.filter((k) => k !== t.key),
                    )
                  }
                />
                <span>
                  <span className="font-semibold">{t.title}</span>
                  <span className="block text-sm text-muted-foreground">{t.help}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Cancellation window for sensor alarms
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"
              value={countdown}
              onChange={(e) => setCountdown(Number(e.target.value))}
            >
              <option value={0}>No window — send at once</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={45}>45 seconds</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            The window only delays sensor alarms so a false alarm can be canceled. It ends by
            itself — an unconscious person never has to confirm anything. The SOS button always
            sends immediately.
          </p>
        </div>
      </section>

      <section className={section} aria-labelledby="location-heading">
        <h2 id="location-heading" className="font-display text-xl font-bold">
          3. Location in the alert
        </h2>
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={includeLocation}
            onChange={(e) => setIncludeLocation(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Include my last location</span>
            <span className="block text-sm text-muted-foreground">
              A map link with the accuracy and the time of the fix. If the fix is old, the message
              says it is out of date; if there is none, it says location unavailable. Medical
              history is never included.
            </span>
          </span>
        </label>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          {fix
            ? `This tab has a location fix from ${new Date(fix.at).toLocaleTimeString()} (±${Math.round(fix.accuracy)} m).`
            : "This tab has no location fix right now; alerts will say location unavailable."}
        </p>
      </section>

      <section className={section} aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="font-display text-xl font-bold">
          4. What your contacts receive
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the exact text and call script. {testMode ? "Test wording shown." : ""}
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
          {alertSmsBody(previewInput)}
        </pre>
        <p className="mt-3 text-sm font-semibold">Automated call script</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
          {alertCallScript(previewInput)}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          The call asks the contact to press 1 to acknowledge. An answered call is reported as
          answered, never as acknowledged, and Lifeline keeps calling the next contact until someone
          presses 1 or the rounds you choose run out.
        </p>
      </section>

      <section className={section} aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="font-display text-xl font-bold">
          5. Test mode and live alerts
        </h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              className="mt-1 size-5"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              disabled={!provider.liveReady}
            />
            <span>
              <span className="font-semibold">Test mode</span>
              <span className="block text-sm text-muted-foreground">
                Only the designated test number can be contacted. Without one, every attempt is
                recorded as “test only — not sent”. Test mode can never reach your contacts.
              </span>
            </span>
          </label>
          {!provider.liveReady && (
            <p className="text-xs text-warning">
              Live mode is locked until the provider is configured, so Lifeline never claims a
              delivery it cannot make.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              Escalate to the next contact after
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"
                value={escalateAfter}
                onChange={(e) => setEscalateAfter(Number(e.target.value))}
              >
                <option value={30}>30 seconds</option>
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds</option>
                <option value={120}>2 minutes</option>
              </select>
            </label>
            <label className={label}>
              Rounds of calls
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
              >
                <option value={1}>1 round</option>
                <option value={2}>2 rounds</option>
                <option value={3}>3 rounds</option>
              </select>
            </label>
          </div>
          <label className={label}>
            Your name as read to contacts
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background p-2"
              value={identityName}
              maxLength={120}
              onChange={(e) => setIdentityName(e.target.value)}
              placeholder="e.g. Asha Sharma"
            />
          </label>
        </div>
      </section>

      <section className={section} aria-labelledby="enable-heading">
        <h2 id="enable-heading" className="font-display text-xl font-bold">
          6. Turn it on
        </h2>
        <label className="mt-3 flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            <span className="font-semibold">
              I choose to send automated texts and calls to my consented contacts.
            </span>
            <span className="block text-sm text-muted-foreground">
              I understand Lifeline must be running with the alarm source connected, that it is not
              a medical device or an emergency service, and that I can switch this off at any time.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Automatic alerts are ON</span>
            <span className="block text-sm text-muted-foreground">
              {testMode
                ? "Currently in test mode: nothing is sent to your real contacts."
                : "Live: qualifying alarms text and call your consented contacts."}
            </span>
          </span>
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="min-h-12 px-6" onClick={submit} disabled={saving}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {saving ? "Saving…" : "Save alert setup"}
          </Button>
          <Button
            variant="outline"
            className="min-h-12"
            onClick={runTest}
            disabled={testing || !setup.settings}
          >
            <FlaskConical className="size-4" aria-hidden="true" />
            {testing ? "Starting…" : "Run a test alert"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {consented.length} contact{consented.length === 1 ? "" : "s"} consented
          </span>
        </div>
        {message && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden="true" />
            {message}
          </p>
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-sm text-critical">
            {saveError}
          </p>
        )}
        {testView && (
          <div className="mt-4">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold">
              <Send className="size-4" aria-hidden="true" /> Test alert status
            </h3>
            <div className="mt-2">
              <AlertStatusPanel eventId={testView.eventId} initial={testView} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A test alert is always created in test mode and can never reach a live contact.
            </p>
          </div>
        )}
      </section>

      <section className={section} aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-xl font-bold">
          Recent alerts
        </h2>
        {setup.recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No alert has been created yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {setup.recent.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-semibold">{r.reasonLabel}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {new Date(r.startedAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.mode === "test" ? "Test" : "Live"} ·{" "}
                  {INCIDENT_STATUS_LABEL[r.status] ?? r.status}
                  {r.lastError ? ` · ${r.lastError}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-bold">Setup still required for live delivery</h2>
        <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
          {provider.policySteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Emergency services (112) are never dialed by this workflow. Use the emergency actions on
          the Monitor page for a public emergency call.
        </p>
      </section>
    </main>
  );
}
