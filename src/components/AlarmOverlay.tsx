import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ambulance,
  Check,
  Copy,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { addLog, cancelAlarm, emergencyNumbers, openAlarmActions } from "@/lib/store";
import { startTracking, stopTracking } from "@/lib/location";
import { startSiren, stopSiren } from "@/lib/siren";
import { buildSosMessage, clockTime, mapsLink, smsHref, telHref } from "@/lib/sos";
import { appStore } from "@/lib/store";
import { cancelDispatch } from "@/lib/dispatch.functions";
import { useServerFn } from "@tanstack/react-start";
import { DispatchStatus } from "@/components/DispatchStatus";

export function AlarmOverlay() {
  const alarm = useApp((s) => s.alarm);
  const countdown = useApp((s) => s.countdownSeconds);
  if (alarm.phase === "idle") return null;
  return alarm.phase === "countdown" ? <Countdown total={countdown} /> : <AlarmActions />;
}

function Countdown({ total }: { total: number }) {
  const alarm = useApp((s) => s.alarm);
  const [left, setLeft] = useState(total);

  useEffect(() => {
    startSiren();
    startTracking();
    const started = alarm.startedAt ?? Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, total - Math.floor((Date.now() - started) / 1000));
      setLeft(l);
      if (l === 0) openAlarmActions();
    }, 200);
    return () => {
      clearInterval(id);
      stopSiren();
    };
  }, [alarm.startedAt, total]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency countdown"
      aria-live="assertive"
      className="fixed inset-0 z-40 flex flex-col items-center justify-between overflow-y-auto bg-destructive px-6 py-10 text-destructive-foreground"
    >
      {alarm.demo && <DemoStrip />}
      <div className="mt-6 text-center">
        <AlertTriangle className="mx-auto size-12 animate-flash" strokeWidth={2.2} />
        <p className="mt-4 text-sm font-semibold uppercase tracking-normal text-destructive-foreground">
          Emergency detected
        </p>
        <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">
          {alarm.reason?.label}
        </h2>
        <p className="mt-2 font-mono text-lg text-destructive-foreground">
          {alarm.reason?.reading}
        </p>
      </div>
      <div className="my-8 grid place-items-center">
        <div className="relative grid size-52 place-items-center rounded-full border-8 border-border/30">
          <span className="font-display text-8xl font-extrabold tabular">{left}</span>
        </div>
        <p className="mt-4 max-w-sm text-center text-destructive-foreground">
          When this reaches 0, Lifeline contacts the emergency contacts you consented to, and shows
          one-tap buttons for emergency services. Emergency services are never dialled
          automatically.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <HoldToCancel />
        <Button
          onClick={openAlarmActions}
          className="rounded-lg border-2 border-border/60 py-4 text-lg font-bold transition hover:bg-card/10"
        >
          Show my emergency actions now
        </Button>
      </div>
    </div>
  );
}

/** Cancelling needs a deliberate 1.5 s hold so a fall or a pocket press can't dismiss it. */
function HoldToCancel() {
  const [p, setP] = useState(0);
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );
  const raf = useRef<number | null>(null);
  const begin = () => {
    const t0 = performance.now();
    const step = () => {
      const v = Math.min(1, (performance.now() - t0) / 1500);
      setP(v);
      if (v >= 1) {
        raf.current = null;
        stopTracking();
        addLog("location", "Location tracking stopped — alarm cancelled");
        cancelAlarm("cancelled by wearer");
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setP(0);
  };
  return (
    <Button
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={end}
      onBlur={end}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      className="relative h-20 select-none touch-none overflow-hidden rounded-lg bg-card text-xl font-extrabold text-critical shadow-sm"
    >
      <span className="absolute inset-y-0 left-0 bg-success/40" style={{ width: `${p * 100}%` }} />
      <span className="relative">{p > 0 ? "Keep holding…" : "I'm OK — hold to cancel"}</span>
    </Button>
  );
}

function DemoStrip() {
  return (
    <div className="w-full max-w-xl rounded-lg bg-warning-soft px-4 py-2 text-center text-sm font-bold text-warning">
      DEMO MODE · simulated alert · call and message buttons are disabled · nobody will be contacted
    </div>
  );
}

function AlarmActions() {
  const alarm = useApp((s) => s.alarm);
  const loc = useApp((s) => s.location);
  const contacts = useApp((s) => s.contacts);
  const n = useApp(emergencyNumbers);
  const now = useNow();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [siren, setSiren] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    startTracking();
    return () => stopSiren();
  }, []);
  useEffect(() => (siren ? startSiren() : stopSiren()), [siren]);

  const msg = buildSosMessage(alarm.reason, loc.fix, { test: alarm.demo });
  const smsContacts = contacts.filter((c) => c.sms);
  const cancelEvent = useServerFn(cancelDispatch);
  const mark = (k: string) => setDone((d) => ({ ...d, [k]: true }));

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Emergency — Lifeline", text: msg });
      else {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
      }
      mark("share");
    } catch {
      /* user dismissed */
    }
  };

  /** Resolving stops GPS tracking unless the wearer explicitly keeps it on. */
  const resolve = (keepTracking: boolean) => {
    const okMsg = `${appStore.state.profile.name} is safe now — the Lifeline alert at ${clockTime(alarm.startedAt ?? Date.now())} is resolved. Thank you.`;
    let openDraft = false;
    if (!alarm.demo && smsContacts.length) {
      openDraft = confirm(
        'Open a draft "I\'m OK" message to your contacts? You must press Send in your messaging app — nothing is delivered from here.',
      );
    }
    const eventId = appStore.state.dispatch?.eventId;
    if (eventId) void cancelEvent({ data: { eventId } }).catch(() => {});
    if (!keepTracking) {
      stopTracking();
      addLog("location", "Location tracking stopped — alarm resolved");
    }
    cancelAlarm("marked resolved");
    if (openDraft)
      window.location.href = smsHref(
        smsContacts.map((c) => c.phone),
        okMsg,
      );
  };

  const fixAge = loc.fix ? Math.round((now - loc.fix.at) / 1000) : null;
  const locState = !loc.fix
    ? null
    : fixAge != null && fixAge > 120
      ? {
          label: `Out of date · last seen ${Math.round(fixAge / 60)} min ago`,
          tone: "text-warning",
        }
      : fixAge != null && fixAge > 30
        ? { label: `Updated ${fixAge}s ago · may be out of date`, tone: "text-muted-foreground" }
        : {
            label: `Live · ±${Math.round(loc.fix.accuracy)} m · ${clockTime(loc.fix.at)}`,
            tone: "text-muted-foreground",
          };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency actions"
      className="fixed inset-0 z-40 overflow-y-auto bg-secondary text-foreground"
    >
      <div className="bg-destructive px-5 pb-6 pt-8">
        <div className="mx-auto max-w-2xl">
          {alarm.demo && <DemoStrip />}
          <p className="mt-3 text-xs font-semibold uppercase tracking-normal text-destructive-foreground">
            {alarm.reason?.label} · {clockTime(alarm.startedAt ?? Date.now())}
          </p>
          <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {alarm.demo ? "Demo alert — this is what happens next" : "Alarm active — action needed"}
          </h2>
          <p className="mt-1 text-destructive-foreground">
            {alarm.demo
              ? "Demo alert: no contact will be messaged. Emergency services are never called automatically — use the button below yourself."
              : "Lifeline is contacting your saved emergency contacts on the channels you enabled, if you consented. Emergency services are never called automatically — use the button below yourself."}
          </p>
          <a
            href={alarm.demo ? undefined : telHref(n.general)}
            onClick={() => mark("call-general")}
            aria-disabled={alarm.demo}
            className={`mt-5 flex items-center justify-center gap-3 rounded-lg bg-card py-5 text-2xl font-extrabold text-foreground shadow-sm ${alarm.demo ? "pointer-events-none opacity-60" : "active:scale-[0.98]"}`}
          >
            <Phone className="size-7" strokeWidth={2.6} /> Call emergency {n.general}
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 px-5 py-6">
        <DispatchStatus />

        {/* Location */}
        <section className="rounded-lg bg-card/5 p-4 ring-1 ring-border/10">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-critical" /> Your location
            <span className={`ml-auto text-xs font-medium ${locState?.tone ?? ""}`}>
              {locState?.label ??
                (loc.status === "denied"
                  ? "Permission denied"
                  : loc.status === "unavailable"
                    ? "Not available on this device"
                    : (loc.error ?? "Locating…"))}
            </span>
          </div>
          {loc.fix ? (
            <a
              href={mapsLink(loc.fix)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block font-mono text-sm text-primary underline-offset-4 hover:underline"
            >
              {loc.fix.lat.toFixed(5)}, {loc.fix.lng.toFixed(5)} — open map
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {loc.status === "denied"
                ? "Enable location for this site so the people you contact can find you. Say your address when you call."
                : "Getting a GPS fix. Messages opened now will say location is unavailable."}
            </p>
          )}
        </section>

        {/* Emergency services */}
        <section className="grid grid-cols-2 gap-3">
          <ServiceButton
            icon={<Shield className="size-5" />}
            label="Police"
            number={n.police}
            demo={alarm.demo}
            onUse={() => mark("police")}
            done={done.police}
          />
          <ServiceButton
            icon={<Ambulance className="size-5" />}
            label="Ambulance"
            number={n.ambulance}
            demo={alarm.demo}
            onUse={() => mark("ambulance")}
            done={done.ambulance}
          />
          {n.smsVerified ? (
            <a
              href={alarm.demo ? undefined : smsHref([n.smsNumber], msg)}
              onClick={() => mark("sms-112")}
              className={`col-span-2 flex items-center gap-3 rounded-lg bg-destructive/15 p-4 ring-1 ring-destructive/30 ${alarm.demo ? "pointer-events-none opacity-50" : "hover:bg-destructive/25"}`}
            >
              <MessageSquare className="size-5 text-critical" />
              <span className="flex-1">
                <span className="block font-semibold">
                  Open emergency text draft ({n.smsNumber})
                </span>
                <span className="block text-xs text-muted-foreground">
                  {n.smsNote} If unsure, call.
                </span>
              </span>
              {done["sms-112"] && (
                <span className="text-xs text-muted-foreground">Draft opened</span>
              )}
            </a>
          ) : (
            <p className="col-span-2 rounded-lg bg-card/5 p-4 text-xs leading-relaxed text-muted-foreground ring-1 ring-border/10">
              Emergency SMS in {n.country}: {n.smsNote} Calling is the recommended option.
            </p>
          )}
        </section>

        {/* Contacts */}
        <section className="rounded-lg bg-card/5 p-4 ring-1 ring-border/10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Your emergency contacts</h3>
            {smsContacts.length > 0 && (
              <a
                href={
                  alarm.demo
                    ? undefined
                    : smsHref(
                        smsContacts.map((c) => c.phone),
                        msg,
                      )
                }
                onClick={() => mark("sms-all")}
                title="Opens a draft message in your messaging app — you must press Send"
                className={`rounded-full bg-card px-3 py-1.5 text-sm font-bold text-foreground ${alarm.demo ? "pointer-events-none opacity-50" : ""}`}
              >
                Open draft for all
              </a>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border/10">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-card/10 text-sm font-bold">
                  {c.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.relationship} · {c.phone}
                  </span>
                </span>
                {c.sms && (
                  <a
                    aria-label={`Open draft message to ${c.name}`}
                    href={alarm.demo ? undefined : smsHref([c.phone], msg)}
                    onClick={() => mark(`s-${c.id}`)}
                    className={`grid size-10 place-items-center rounded-full ${done[`s-${c.id}`] ? "bg-accent" : "bg-card/10"} ${alarm.demo ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <MessageSquare className="size-4" />
                  </a>
                )}
                {c.call && (
                  <a
                    aria-label={`Call ${c.name}`}
                    href={alarm.demo ? undefined : telHref(c.phone)}
                    onClick={() => mark(`c-${c.id}`)}
                    className={`grid size-10 place-items-center rounded-full ${done[`c-${c.id}`] ? "bg-accent" : "bg-card/10"} ${alarm.demo ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Phone className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Message preview */}
        <section className="rounded-lg bg-card/5 p-4 ring-1 ring-border/10">
          <div className="flex items-center gap-2">
            <h3 className="mr-auto font-semibold">Message draft to send</h3>
            <Button
              onClick={share}
              className="flex items-center gap-1.5 rounded-full bg-card/10 px-3 py-1.5 text-sm hover:bg-card/20"
            >
              {copied ? <Copy className="size-4" /> : <Share2 className="size-4" />}{" "}
              {copied ? "Copied" : "Share or copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This is a draft only. Lifeline cannot confirm delivery — you send it yourself.
          </p>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">
            {msg}
          </pre>
        </section>

        <div className="flex flex-col gap-3 pb-[48dvh] sm:pb-28">
          <Button
            onClick={() => setSiren((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-card/10 px-4 py-3 font-semibold hover:bg-card/20"
          >
            {siren ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}{" "}
            {siren ? "Stop siren" : "Sound siren"}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => resolve(false)}
              className="flex-1 rounded-lg bg-success px-4 py-3 font-bold text-success hover:bg-success"
            >
              <Check className="mr-1 inline size-4" /> I'm safe — resolve & stop location
            </Button>
            <Button
              onClick={() => resolve(true)}
              variant="outline"
              className="rounded-lg px-4 py-3 font-semibold"
            >
              I'm safe — keep location on
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceButton(props: {
  icon: React.ReactNode;
  label: string;
  number: string;
  demo: boolean;
  done?: boolean;
  onUse: () => void;
}) {
  return (
    <a
      href={props.demo ? undefined : telHref(props.number)}
      onClick={props.onUse}
      className={`flex items-center gap-3 rounded-lg bg-card/5 p-4 ring-1 ring-border/10 ${props.demo ? "pointer-events-none opacity-50" : "hover:bg-card/10"}`}
    >
      <span className="grid size-10 place-items-center rounded-lg bg-card/10">{props.icon}</span>
      <span className="flex-1">
        <span className="block text-sm text-muted-foreground">{props.label}</span>
        <span className="block font-mono text-xl font-bold">{props.number}</span>
      </span>
      {props.done && <span className="text-xs text-muted-foreground">Opened</span>}
    </a>
  );
}
