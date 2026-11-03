import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { MONTH_ROWS, averageCoverage, discWidth, monthRows } from "@/lib/readingMonths";
import "../styles/reading-months-chart.css";

/**
 * Isometric oval-disc chart of reading coverage.
 *
 * Every value comes from `readingDays` — the device-local record of *which*
 * vitals produced a reading on a day (never a measured value). A disc shows the
 * share of that month's elapsed days that had at least one reading, so a month
 * with no readings honestly shows 0 rather than a placeholder. Demo mode is
 * labelled, because the simulator writes to the same record.
 */
export function ReadingMonthsChart() {
  const readingDays = useApp((s) => s.readingDays);
  const demo = useApp((s) => s.demoMode);
  const now = useNow(60_000);
  const [animated, setAnimated] = useState(false);

  const rows = useMemo(() => monthRows(readingDays, now), [readingDays, now]);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.value));
  const average = averageCoverage(rows.map((r) => r.value));
  const anyData = rows.some((r) => r.loggedDays > 0);

  return (
    <section className={`rmc${animated ? " is-animated" : ""}`} aria-labelledby="rmc-title">
      <div className="rmc-card">
        <h3 className="rmc-title" id="rmc-title">
          Reading days by month
        </h3>
        <p className="rmc-meta">
          Last {MONTH_ROWS} months · share of days with at least one reading
        </p>

        <div className="rmc-chart" role="list">
          {rows.map((row) => {
            // Disc width is the value against the dataset maximum, so the discs
            // stay comparable. A month with no reading keeps a small marker
            // instead of collapsing to nothing; its score still reads 0.
            const width = discWidth(row.value, max);
            return (
              <div
                className="rmc-row"
                role="listitem"
                key={row.key}
                aria-label={`${row.long}: a reading on ${row.loggedDays} of ${row.elapsed} days, ${row.value}% of the month so far`}
              >
                <div className="rmc-track" aria-hidden="true">
                  <div className="rmc-ring">
                    <svg
                      className="rmc-ring-line"
                      viewBox="0 0 294 51"
                      preserveAspectRatio="none"
                    >
                      <ellipse
                        cx="147"
                        cy="25.5"
                        rx="146.6"
                        ry="25.1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.8"
                        strokeDasharray="2 2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <div className="rmc-oval" style={{ "--rmc-w": `${width}%` } as React.CSSProperties}>
                      <span className="rmc-score">{row.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rmc-footer">
          <ul className="rmc-legend" aria-label="Months, oldest first">
            {rows.map((row) => (
              <li className="rmc-legend-item" key={row.key}>
                <span className="rmc-legend-dot" aria-hidden="true" />
                <span className="rmc-legend-lbl">{row.short}</span>
              </li>
            ))}
          </ul>
          <p className="rmc-avg" aria-label={`Average coverage ${average.toFixed(1)} percent`}>
            Avg <strong>{average.toFixed(1)}</strong>
          </p>
        </div>

        <p className="rmc-note">
          {demo
            ? "Demo mode is on — these days include synthetic demo readings."
            : anyData
              ? "Counted in this browser only. Only which day had a reading is kept, never the measured value."
              : "No readings recorded yet. A month fills in after a supported device sends a reading."}
        </p>
      </div>
    </section>
  );
}
