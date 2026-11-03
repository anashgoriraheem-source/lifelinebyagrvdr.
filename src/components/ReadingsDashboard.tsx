import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bluetooth,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { isStale } from "@/lib/detection";
import type { LogEntry, VitalKey } from "@/lib/types";
import {
  DISPLAY_ORDER,
  MONTH_LONG,
  bucketSlices,
  buildMonthBuckets,
  dayDelta,
  ridgeMarkers,
  ridgePoints,
  sliceDashes,
} from "@/lib/readingsOverview";
import "../styles/readings-dashboard.css";

const MONTHS_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const VITAL_CLASS: Record<VitalKey, string> = {
  hr: "is-hr",
  spo2: "is-spo2",
  bp: "is-bp",
  glucose: "is-glucose",
};

const ROW_META: Record<
  LogEntry["kind"],
  { icon: typeof Siren; to: "/contacts" | "/monitor" | "/account" }
> = {
  alarm: { icon: Siren, to: "/contacts" },
  sos: { icon: ShieldAlert, to: "/contacts" },
  cancel: { icon: ShieldCheck, to: "/contacts" },
  location: { icon: MapPin, to: "/monitor" },
  device: { icon: Bluetooth, to: "/monitor" },
  info: { icon: Activity, to: "/monitor" },
};

/** Counts up from the previous value; the final value is always what renders at rest. */
function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}

/**
 * "Dashboard home" for the readings log: three live KPIs, a month selector with
 * a trend, a vital-coverage donut, recent activity and the current sources.
 *
 * Every figure is computed from this device's own records — the days on which a
 * supported vital produced a reading (`readingDays`), the live readings in the
 * store, saved contacts and the session activity log. A month with no readings
 * shows zeros, never a placeholder sample.
 */
export function ReadingsDashboard() {
  const readingDays = useApp((s) => s.readingDays);
  const vitals = useApp((s) => s.vitals);
  const device = useApp((s) => s.device);
  const contacts = useApp((s) => s.contacts);
  const log = useApp((s) => s.log);
  const demo = useApp((s) => s.demoMode);
  const { t, formatTime, tag } = useI18n();
  const now = useNow(5000);

  const buckets = useMemo(() => buildMonthBuckets(readingDays, now, 12), [readingDays, now]);
  const [selected, setSelected] = useState(buckets.length - 1);
  const [hovered, setHovered] = useState<VitalKey | null>(null);
  const ridgeRef = useRef<HTMLDivElement>(null);

  // Keep the newest month selected when the component mounts after a month change.
  useEffect(() => {
    setSelected(buckets.length - 1);
  }, [buckets.length]);

  const index = Math.min(selected, buckets.length - 1);
  const month = buckets[index];
  const previous = index > 0 ? buckets[index - 1] : null;
  const delta = dayDelta(month.loggedDays, previous?.loggedDays ?? null);

  const fresh = DISPLAY_ORDER.filter((k) => vitals[k] && !isStale(k, vitals[k], now));
  const reachable = contacts.filter((c) => c.call || c.sms).length;
  const latestReceived = Math.max(
    0,
    ...DISPLAY_ORDER.map((k) => vitals[k]?.receivedAt ?? 0),
    ...(device.lastReadingAt ? [device.lastReadingAt] : []),
  );
  const anyReadings = buckets.some((b) => b.loggedDays > 0);

  const slices = bucketSlices(month);
  const dashes = sliceDashes(slices);
  const hoveredSlice = hovered ? slices.find((s) => s.key === hovered) : undefined;

  const values = buckets.map((b) => b.loggedDays);
  const points = ridgePoints(values);
  const markers = ridgeMarkers(values);
  const marker = markers[index] ?? { x: 0, y: 50 };

  const recent = log.slice(0, 5);
  const relative = (at: number) => {
    const minutes = Math.max(0, Math.round((now - at) / 60_000));
    if (minutes < 1) return "Just now";
    try {
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      if (minutes < 60) return rtf.format(-minutes, "minute");
      const hours = Math.round(minutes / 60);
      if (hours < 24) return rtf.format(-hours, "hour");
      return rtf.format(-Math.round(hours / 24), "day");
    } catch {
      return `${minutes} min ago`;
    }
  };

  const note = !month.loggedDays
    ? "no readings recorded"
    : month.loggedDays === month.elapsed
      ? "every day covered"
      : `${month.elapsed - month.loggedDays} days without a reading`;
  const coveragePct = Math.round(month.coverage * 100);
  const unitText = "bpm · % · mmHg · mg/dL";

  const pick = (i: number) => setSelected(Math.max(0, Math.min(buckets.length - 1, i)));

  return (
    <section className="rd" aria-labelledby="rd-title">
      <div className="rd-sheet">
        <header className="rd-head">
          <h2 className="rd-eyebrow" id="rd-title">
            Readings overview
          </h2>
          <div className="rd-head-row">
            <p className="rd-code">{month.code}</p>
            <p className="rd-head-right">AAPDA SETU · HEALTH LOG</p>
          </div>
        </header>

        <div className="rd-frame">
          <div className="rd-serial">
            <div className="rd-serial-field">
              <span className="rd-serial-label">MONTH</span>
              <span className="rd-serial-value">
                {MONTH_LONG[month.monthIndex]} {month.year}
              </span>
            </div>
            <div className="rd-serial-field">
              <span className="rd-serial-label">UNITS</span>
              <span className="rd-serial-value">{unitText}</span>
            </div>
            <div className="rd-serial-field">
              <span className="rd-serial-label">UPDATED</span>
              <span className="rd-serial-value" data-testid="rd-updated">
                {latestReceived ? formatTime(latestReceived) : "No readings yet"}
              </span>
            </div>
          </div>

          <div className="rd-timeline">
            <div className="rd-timeline-head">
              <p className="rd-timeline-title">READING DAYS BY MONTH</p>
              <div className="rd-readout" aria-live="polite">
                <span className="rd-ro-month">
                  {MONTHS_SHORT[month.monthIndex]} {month.year}
                </span>
                <span className="rd-ro-value">
                  {month.loggedDays} / {month.elapsed} days
                </span>
                {delta != null ? (
                  <span className={`rd-ro-delta ${delta >= 0 ? "is-up" : "is-down"}`}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                ) : null}
                <span className="rd-ro-note">{note}</span>
              </div>
            </div>
            <div className="rd-axis" role="tablist" aria-label="Months with recorded readings">
              {buckets.map((b, i) => (
                <button
                  key={b.key}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${b.label}: readings on ${b.loggedDays} of ${b.elapsed} days`}
                  className={`rd-node${i === index ? " is-selected" : ""}`}
                  style={{ "--i": i } as React.CSSProperties}
                  onClick={() => pick(i)}
                  onKeyDown={(e) => {
                    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                    if (!step) return;
                    e.preventDefault();
                    pick(i + step);
                  }}
                >
                  <span className="rd-dot" />
                  <span className="rd-node-label">{MONTHS_SHORT[b.monthIndex]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rd-grid">
            <div className="rd-col">
              <div className="rd-kpis">
                <div className="rd-kpi rd-kpi--days">
                  <p className="rd-kpi-label">Reading days</p>
                  <div className="rd-kpi-value">
                    <AnimatedNumber value={month.loggedDays} />
                  </div>
                  <p className={`rd-kpi-delta${delta != null && delta >= 0 ? " is-up" : ""}`}>
                    {delta == null
                      ? "no earlier month to compare"
                      : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}% vs ${previous?.label}`}
                  </p>
                </div>
                <div className="rd-kpi rd-kpi--live">
                  <p className="rd-kpi-label">Live now</p>
                  <div className="rd-kpi-value">
                    <AnimatedNumber value={fresh.length} />
                    <span className="rd-kpi-of"> / {DISPLAY_ORDER.length}</span>
                  </div>
                  <p className="rd-kpi-delta">
                    {fresh.length
                      ? `reading ${formatTime(Math.max(...fresh.map((k) => vitals[k]!.receivedAt)))}`
                      : "no current reading"}
                  </p>
                </div>
                <div className="rd-kpi rd-kpi--contacts">
                  <p className="rd-kpi-label">Contacts ready</p>
                  <div className="rd-kpi-value">
                    <AnimatedNumber value={reachable} />
                    <span className="rd-kpi-of"> / {contacts.length}</span>
                  </div>
                  <p className="rd-kpi-delta">
                    {contacts.length ? "can receive an alert" : "none saved yet"}
                  </p>
                </div>
              </div>

              <div className="rd-panel rd-panel--coverage">
                <p className="rd-panel-title">
                  VITAL COVERAGE <span>{month.vitalDaysTotal} vital-days</span>
                </p>
                <div className="rd-donut-wrap" onMouseLeave={() => setHovered(null)}>
                  <div className="rd-donut">
                    <svg
                      className="rd-donut-svg"
                      viewBox="0 0 42 42"
                      role="img"
                      aria-label={
                        slices.length
                          ? `Vital coverage in ${month.label}: ${slices
                              .map((s) => `${t(`reading.${s.key}`)} ${s.days} days`)
                              .join(", ")}`
                          : `No readings recorded in ${month.label}`
                      }
                    >
                      <circle className="rd-ring" cx="21" cy="21" r="15.915" />
                      {slices.map((slice, i) => (
                        <circle
                          key={slice.key}
                          className={`rd-seg ${VITAL_CLASS[slice.key]}${hovered === slice.key ? " is-hi" : ""}${
                            hovered && hovered !== slice.key ? " is-dim" : ""
                          }`}
                          cx="21"
                          cy="21"
                          r="15.915"
                          strokeDasharray={dashes[i].dashArray}
                          strokeDashoffset={dashes[i].dashOffset}
                          onMouseEnter={() => setHovered(slice.key)}
                        />
                      ))}
                    </svg>
                    <div className="rd-donut-center" aria-hidden="true">
                      <b>{hoveredSlice ? hoveredSlice.days : month.vitalDaysTotal}</b>
                      <small>
                        {hoveredSlice
                          ? t(`reading.${hoveredSlice.key}`).toUpperCase()
                          : "VITAL-DAYS"}
                      </small>
                    </div>
                  </div>
                  <ul className="rd-legend">
                    {DISPLAY_ORDER.map((key) => {
                      const days = month.vitalDays[key];
                      const width = month.loggedDays
                        ? Math.round((days / month.loggedDays) * 100)
                        : 0;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            className={`rd-legend-row ${VITAL_CLASS[key]}${hovered === key ? " is-hi" : ""}`}
                            onMouseEnter={() => setHovered(key)}
                            onFocus={() => setHovered(key)}
                            onBlur={() => setHovered(null)}
                            aria-label={`${t(`reading.${key}`)}: recorded on ${days} of ${month.elapsed} days`}
                          >
                            <span className="rd-swatch" aria-hidden="true" />
                            <span className="rd-leg-name">{t(`reading.${key}`)}</span>
                            <span className="rd-bar" aria-hidden="true">
                              <span className="rd-bar-fill" style={{ width: `${width}%` }} />
                            </span>
                            <span className="rd-leg-amt">{days}d</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="rd-panel rd-panel--trend">
                <p className="rd-panel-title">
                  READING TREND <span>{month.loggedDays} days</span>
                </p>
                <div
                  className="rd-ridge"
                  ref={ridgeRef}
                  onClick={(e) => {
                    const rect = ridgeRef.current?.getBoundingClientRect();
                    if (!rect || !rect.width) return;
                    const ratio = (e.clientX - rect.left) / rect.width;
                    pick(Math.round(ratio * (buckets.length - 1)));
                  }}
                  aria-hidden="true"
                >
                  <div className="rd-ridge-chart">
                    <svg className="rd-ridge-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {points.map((p, i) => (
                        <line
                          key={i}
                          className="rd-ridge-line"
                          x1={p.x}
                          x2={p.x}
                          y1={100}
                          y2={p.y}
                        />
                      ))}
                      <line
                        className="rd-ridge-accent"
                        x1={marker.x}
                        x2={marker.x}
                        y1={100}
                        y2={marker.y}
                      />
                    </svg>
                    <span
                      className="rd-ridge-dot"
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                    />
                  </div>
                  <div className="rd-ridge-labels">
                    {buckets.map((b, i) => (
                      <span key={b.key} className={i === index ? "is-selected" : undefined}>
                        {MONTHS_SHORT[b.monthIndex]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rd-col rd-col--side">
              <div className="rd-panel rd-recent">
                <p className="rd-panel-title">
                  RECENT ACTIVITY <span>{String(recent.length).padStart(2, "0")}</span>
                </p>
                {recent.length ? (
                  <ul>
                    {recent.map((row) => {
                      const meta = ROW_META[row.kind];
                      return (
                        <li key={row.id}>
                          <Link to={meta.to} className="rd-recent-row">
                            <meta.icon
                              className="rd-recent-icon"
                              aria-hidden="true"
                              strokeWidth={1.7}
                            />
                            <span className="rd-recent-name">{row.text}</span>
                            <span className="rd-recent-date">{relative(row.at)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rd-empty">
                    No activity on this device yet. Readings, device connections and alerts appear
                    here for this session.
                  </p>
                )}
              </div>

              <div className="rd-panel rd-sources">
                <p className="rd-panel-title">
                  LIVE SOURCES <span>{fresh.length} current</span>
                </p>
                <ul>
                  {DISPLAY_ORDER.map((key) => {
                    const reading = vitals[key];
                    const stale = reading ? isStale(key, reading, now) : false;
                    return (
                      <li key={key}>
                        <span
                          className={`rd-source-dot ${VITAL_CLASS[key]}${reading && !stale ? " is-live" : ""}`}
                          aria-hidden="true"
                        />
                        <span className="rd-source-name">{t(`reading.${key}`)}</span>
                        <span className="rd-source-value">
                          {reading
                            ? `${reading.source}${stale ? " · out of date" : ""}`
                            : "Not provided"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rd-footer">
                <div className="rd-table-wrap">
                  <table className="rd-table">
                    <tbody>
                      <tr>
                        <th scope="row">DAYS LOGGED</th>
                        <td>
                          {month.loggedDays} of {month.elapsed}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">VITAL-DAYS</th>
                        <td>{month.vitalDaysTotal}</td>
                      </tr>
                      <tr>
                        <th scope="row">PERIOD</th>
                        <td>
                          {MONTHS_SHORT[month.monthIndex]} {month.year} · {month.elapsed} days
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rd-stamp">
                  <span className="rd-stamp-title">
                    DAYS WITH READINGS · {MONTHS_SHORT[month.monthIndex]}
                  </span>
                  <div className="rd-stamp-body">
                    <span className="rd-stamp-big">
                      +<AnimatedNumber value={month.loggedDays} />
                    </span>
                    <span className="rd-stamp-num">{coveragePct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="rd-note">
            {demo ? (
              <>
                <TriangleAlert className="rd-note-icon" aria-hidden="true" />
                Demo mode is on — these counts include synthetic readings. Nobody is contacted.
              </>
            ) : anyReadings ? (
              `Counted in this browser only, from supported device readings. Values are not stored here; only which vital was recorded on each day.`
            ) : (
              <>
                No readings have been recorded on this device yet.{" "}
                <Link to="/monitor">Set up a health device</Link> to start the log — first aid and
                contacts work without one.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
