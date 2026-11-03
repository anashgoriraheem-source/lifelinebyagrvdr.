import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowDown, Check, ChevronLeft, ChevronRight, Download, TableProperties } from "lucide-react";
import type { PracticeCsvRow, PracticeRowStatus } from "@/lib/practice";
import { STATUS_LABEL } from "@/lib/practice";
import "@/styles/practice-progress-table.css";

const PER_PAGE = 8;

const LIFECYCLE: Record<PracticeRowStatus, number> = {
  completed: 0,
  "review-needed": 1,
  "not-started": 2,
  withheld: 3,
};

type Filter = "all" | PracticeRowStatus;
type SortKey = "order" | "customer" | "level" | "attempts" | "status" | "last";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "review-needed", label: "Review needed" },
  { key: "not-started", label: "Not started" },
  { key: "withheld", label: "Withheld" },
];

const orderKey = (row: PracticeCsvRow) => row.scenario.level * 100 + row.scenario.index;

interface Props {
  rows: PracticeCsvRow[];
  loading: boolean;
  onOpen: (scenarioId: string) => void;
  /** Downloads the chosen rows and resolves with how many were written. */
  onExport: (scope: "all" | "selected", ids: string[]) => Promise<number>;
}

export function PracticeProgressTable({ rows, loading, onOpen, onExport }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "order",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Record<string, true>>({});
  const [entered, setEntered] = useState(true);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const markerY = useRef(0);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = {
      all: rows.length,
      completed: 0,
      "review-needed": 0,
      "not-started": 0,
      withheld: 0,
    };
    for (const row of rows) base[row.status] += 1;
    return base;
  }, [rows]);

  const matching = useMemo(() => {
    const filtered = rows.filter((row) => filter === "all" || row.status === filter);
    return [...filtered].sort((a, b) => {
      let result = 0;
      if (sort.key === "order") result = orderKey(a) - orderKey(b);
      else if (sort.key === "level") result = a.scenario.level - b.scenario.level;
      else if (sort.key === "attempts") result = a.attempts - b.attempts;
      else if (sort.key === "status") result = LIFECYCLE[a.status] - LIFECYCLE[b.status];
      else if (sort.key === "customer") result = a.scenario.title.localeCompare(b.scenario.title);
      else {
        const av = a.lastPractisedAt ? Date.parse(a.lastPractisedAt) : 0;
        const bv = b.lastPractisedAt ? Date.parse(b.lastPractisedAt) : 0;
        result = av - bv;
      }
      return sort.dir === "asc" ? result : -result;
    });
  }, [rows, filter, sort]);

  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PER_PAGE;
  const visibleRows = matching.slice(start, start + PER_PAGE);
  const selectedCount = Object.keys(picked).length;

  const pageNumbers = useMemo(() => {
    const set = new Set<number>([1, pages, current, current - 1, current + 1]);
    return [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  }, [pages, current]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const toggleSort = (key: SortKey) => {
    setSort((previous) => {
      if (previous.key === key) {
        return { key, dir: previous.dir === "asc" ? "desc" : "asc" };
      }
      const defaultDir =
        key === "attempts" || key === "last" || key === "status" ? "desc" : "asc";
      return { key, dir: defaultDir };
    });
    setPage(1);
  };

  const pick = (scenarioId: string, on: boolean) => {
    setPicked((previous) => {
      const next = { ...previous };
      if (on) next[scenarioId] = true;
      else delete next[scenarioId];
      return next;
    });
  };

  const pageIds = visibleRows.map((row) => row.scenario.id);
  const pagePicked = pageIds.filter((id) => picked[id]).length;
  const allOnPage = pageIds.length > 0 && pagePicked === pageIds.length;
  const someOnPage = pagePicked > 0 && !allOnPage;

  const setAllOnPage = (on: boolean) => {
    setPicked((previous) => {
      const next = { ...previous };
      for (const id of pageIds) {
        if (on) next[id] = true;
        else delete next[id];
      }
      return next;
    });
  };

  /* The travelling hover band, as in the design: one element that slides to the
     row under the pointer, with the distance deciding the duration. */
  const moveMarker = (row: HTMLElement | null) => {
    const wrap = wrapRef.current;
    const marker = markerRef.current;
    if (!wrap || !marker) return;
    if (!row) {
      marker.setAttribute("data-on", "0");
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const y = rowRect.top - wrapRect.top - wrap.clientTop;
    const wasOn = marker.getAttribute("data-on") === "1";
    const distance = wasOn ? Math.abs(y - markerY.current) : 0;
    marker.style.setProperty(
      "--dt1-marker-dur",
      `${Math.round(Math.min(520, Math.max(190, 150 + distance * 0.45)))}ms`,
    );
    if (!wasOn) marker.style.transition = "none";
    marker.style.height = `${rowRect.height}px`;
    marker.style.translate = `0 ${y}px`;
    if (!wasOn) {
      void marker.offsetWidth;
      marker.style.transition = "";
      void marker.offsetWidth;
    }
    markerY.current = y;
    marker.setAttribute("data-on", "1");
  };

  const runExport = async (scope: "all" | "selected") => {
    const list = scope === "selected" ? rows.filter((row) => picked[row.scenario.id]) : matching;
    if (!list.length) {
      showToast("Nothing to export");
      return;
    }
    setBusy(true);
    try {
      const written = await onExport(
        scope,
        list.map((row) => row.scenario.id),
      );
      showToast(
        `${written} scenario${written === 1 ? "" : "s"} downloaded as CSV`,
      );
      if (scope === "selected") setPicked({});
    } catch {
      showToast("The export could not be downloaded. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const ariaSort = (key: SortKey) => {
    if (sort.key !== key) return undefined;
    return sort.dir === "asc" ? "ascending" : "descending";
  };
  const sortMark = <ArrowDown className="dt1-sort-ind" aria-hidden="true" />;

  return (
    <section className="dt1-section" data-dt1 data-dt1-enter={entered ? "" : undefined}>
      <div className="dt1-card" data-dt1-bulk={selectedCount > 0 ? "on" : "off"}>
        <div className="dt1-shell" data-dt1-toast={toast ? "on" : "off"}>
          <div className="dt1-head">
            <div className="dt1-titles">
              <h2 className="dt1-title">Practice progress</h2>
              <p className="dt1-meta">
                {rows.length} scenarios &middot; {PER_PAGE} per page
              </p>
            </div>
            <span className="dt1-export">
              <button
                type="button"
                className="dt1-btn dt1-btn--beam"
                onClick={() => void runExport("all")}
                disabled={busy || loading}
              >
                <span className="dt1-beam-track" aria-hidden="true">
                  <span className="dt1-beam" />
                </span>
                <Download aria-hidden="true" /> Export CSV
              </button>
            </span>
          </div>

          <div className="dt1-toolwrap">
            <div className="dt1-tools">
              <div className="dt1-chips" role="group" aria-label="Filter scenarios by status">
                {FILTERS.map((entry, i) => {
                  const styles =
                    entry.key === "all"
                      ? {
                          "--dt1-i": i,
                          "--dt1-fc": "var(--dt1-accent-line)",
                          "--dt1-fc-fill": "var(--dt1-accent)",
                          "--dt1-fc-ink": "var(--dt1-accent-ink)",
                          "--dt1-fc-cap": "var(--primary)",
                          "--dt1-fc-cap-ink": "var(--primary-foreground)",
                        }
                      : entry.key === "completed"
                        ? {
                            "--dt1-i": i,
                            "--dt1-fc": "var(--dt1-completed)",
                            "--dt1-fc-fill": "var(--dt1-completed-grad)",
                            "--dt1-fc-ink": "var(--dt1-completed-ink)",
                          }
                        : entry.key === "review-needed"
                          ? {
                              "--dt1-i": i,
                              "--dt1-fc": "var(--dt1-review)",
                              "--dt1-fc-fill": "var(--dt1-review-grad)",
                              "--dt1-fc-ink": "var(--dt1-review-ink)",
                            }
                          : entry.key === "withheld"
                            ? {
                                "--dt1-i": i,
                                "--dt1-fc": "var(--dt1-withheld)",
                                "--dt1-fc-fill": "var(--dt1-withheld-grad)",
                                "--dt1-fc-ink": "var(--dt1-withheld-ink)",
                              }
                            : {
                                "--dt1-i": i,
                                "--dt1-fc": "var(--dt1-new)",
                                "--dt1-fc-fill": "var(--dt1-new-grad)",
                                "--dt1-fc-ink": "var(--dt1-new-ink)",
                              };
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className="dt1-fcard"
                      data-dt1-filter={entry.key}
                      aria-pressed={filter === entry.key}
                      aria-controls="practice-progress-body"
                      style={styles as CSSProperties}
                      onClick={() => {
                        setFilter(entry.key);
                        setPage(1);
                      }}
                    >
                      <span className="dt1-fcard-dot" aria-hidden="true" />
                      <span className="dt1-fcard-name">{entry.label}</span>
                      <span className="dt1-fcard-n">{counts[entry.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dt1-bulk" aria-live="polite">
              <span className="dt1-bulk-n">{selectedCount} selected</span>
              <span className="dt1-spacer" />
              <button type="button" className="dt1-btn dt1-btn--ghost" onClick={() => setPicked({})}>
                Clear
              </button>
              <button
                type="button"
                className="dt1-btn dt1-btn--primary dt1-btn--beam"
                onClick={() => void runExport("selected")}
                disabled={busy}
              >
                <span className="dt1-beam-track" aria-hidden="true">
                  <span className="dt1-beam" />
                </span>
                <Download aria-hidden="true" /> Export selected
              </button>
            </div>
          </div>

          <div
            className="dt1-tablewrap"
            ref={wrapRef}
            onPointerOver={(event) => {
              const target = event.target as HTMLElement;
              const row = target.closest?.("[data-dt1-row]") as HTMLElement | null;
              if (row) moveMarker(row);
            }}
            onPointerLeave={() => moveMarker(null)}
          >
            <div className="dt1-marker" ref={markerRef} data-on="0" aria-hidden="true" />
            <div className="dt1-zone">
              <table className="dt1-table" hidden={loading || visibleRows.length === 0}>
                <thead className="dt1-thead">
                  <tr>
                    <th className="dt1-th dt1-th--pick" scope="col">
                      <label className="dt1-check">
                        <input
                          type="checkbox"
                          className="dt1-check-input"
                          aria-label="Select all scenarios on this page"
                          checked={allOnPage}
                          ref={(node) => {
                            if (node) node.indeterminate = someOnPage;
                          }}
                          onChange={(event) => setAllOnPage(event.target.checked)}
                        />
                        <span className="dt1-check-box" aria-hidden="true">
                          <Check className="dt1-check-icon" />
                        </span>
                      </label>
                    </th>
                    <th className="dt1-th dt1-th--order" scope="col" aria-sort={ariaSort("order")}>
                      <button type="button" className="dt1-sort" onClick={() => toggleSort("order")}>
                        Ref {sortMark}
                      </button>
                    </th>
                    <th className="dt1-th dt1-th--cust" scope="col" aria-sort={ariaSort("customer")}>
                      <button
                        type="button"
                        className="dt1-sort"
                        onClick={() => toggleSort("customer")}
                      >
                        Scenario {sortMark}
                      </button>
                    </th>
                    <th className="dt1-th dt1-th--email" scope="col" aria-sort={ariaSort("level")}>
                      <button type="button" className="dt1-sort" onClick={() => toggleSort("level")}>
                        Level {sortMark}
                      </button>
                    </th>
                    <th className="dt1-th dt1-th--total" scope="col" aria-sort={ariaSort("attempts")}>
                      <button
                        type="button"
                        className="dt1-sort"
                        onClick={() => toggleSort("attempts")}
                      >
                        Attempts {sortMark}
                      </button>
                    </th>
                    <th className="dt1-th dt1-th--status" scope="col" aria-sort={ariaSort("status")}>
                      <button type="button" className="dt1-sort" onClick={() => toggleSort("status")}>
                        Status {sortMark}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="dt1-tbody" id="practice-progress-body">
                  {visibleRows.map((row, i) => {
                    const id = row.scenario.id;
                    const selected = Boolean(picked[id]);
                    return (
                      <tr
                        key={id}
                        className="dt1-row"
                        data-dt1-row
                        data-dt1-sel={selected ? "1" : "0"}
                        data-status={row.status}
                        data-order={orderKey(row)}
                        data-customer={row.scenario.title}
                        data-email={`Level ${row.scenario.level}`}
                        data-total={row.attempts}
                        style={{ "--dt1-i": i } as CSSProperties}
                      >
                        <td className="dt1-cell dt1-cell--pick">
                          <span className="dt1-rowline" aria-hidden="true" />
                          <label className="dt1-check">
                            <input
                              type="checkbox"
                              className="dt1-check-input"
                              data-dt1-pick
                              checked={selected}
                              aria-label={`Select ${row.scenario.title}`}
                              onChange={(event) => pick(id, event.target.checked)}
                            />
                            <span className="dt1-check-box" aria-hidden="true">
                              <Check className="dt1-check-icon" />
                            </span>
                          </label>
                        </td>
                        <td className="dt1-cell dt1-cell--order">
                          <span className="dt1-order">
                            #L{row.scenario.level}-{String(row.scenario.index).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="dt1-cell dt1-cell--cust">
                          <span className="dt1-avatar" aria-hidden="true">
                            L{row.scenario.level}
                          </span>
                          <button
                            type="button"
                            className="dt1-name"
                            onClick={() => onOpen(id)}
                            style={{
                              background: "none",
                              border: 0,
                              padding: 0,
                              minHeight: 0,
                              color: "inherit",
                              font: "inherit",
                              cursor: "pointer",
                              textAlign: "start",
                            }}
                          >
                            {row.scenario.title}
                          </button>
                        </td>
                        <td className="dt1-cell dt1-cell--email">
                          <span className="dt1-email">
                            L{row.scenario.level} &middot; level {row.scenario.level}
                          </span>
                        </td>
                        <td className="dt1-cell dt1-cell--total">
                          <span className="dt1-total">{row.attempts}</span>
                        </td>
                        <td className="dt1-cell dt1-cell--status">
                          <span className={`dt1-badge dt1-badge--${row.status}`}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {loading ? (
                <div className="dt1-skel" aria-hidden="true">
                  {Array.from({ length: PER_PAGE }, (_, i) => (
                    <div className="dt1-skel-row" key={i} />
                  ))}
                </div>
              ) : null}

              {!loading && visibleRows.length === 0 ? (
                <div className="dt1-empty">
                  <span className="dt1-empty-ico">
                    <TableProperties aria-hidden="true" />
                  </span>
                  <span className="dt1-empty-t">
                    {filter === "all"
                      ? "No scenarios available in this build"
                      : "No scenarios match this filter"}
                  </span>
                  <p className="dt1-empty-p">
                    {filter === "all"
                      ? "The practice library has not loaded. Reload this page to try again."
                      : "Choose another status, or open a level above to start a new scenario."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="dt1-foot" hidden={loading || visibleRows.length === 0}>
            <div className="dt1-range">
              {matching.length
                ? `Showing ${start + 1}\u2013${start + visibleRows.length} of ${matching.length}`
                : "No scenarios to show"}
            </div>
            <div className="dt1-meter" aria-hidden="true">
              <span
                className="dt1-meter-fill"
                style={{
                  width: matching.length
                    ? `${(((start + visibleRows.length) / matching.length) * 100).toFixed(1)}%`
                    : "0%",
                }}
              />
            </div>
            <div className="dt1-pager">
              <button
                type="button"
                className="dt1-page"
                data-dt1-prev
                aria-label="Previous page"
                disabled={current <= 1}
                onClick={() => setPage(Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              {pageNumbers.map((n, index) => {
                const previous = pageNumbers[index - 1];
                return (
                  <span key={n} style={{ display: "contents" }}>
                    {previous && n - previous > 1 ? (
                      <span className="dt1-range" aria-hidden="true">
                        &hellip;
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="dt1-page"
                      data-dt1-page={n}
                      aria-current={n === current ? "page" : undefined}
                      aria-label={`Page ${n}`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                className="dt1-page"
                data-dt1-next
                aria-label="Next page"
                disabled={current >= pages}
                onClick={() => setPage(Math.min(pages, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="dt1-toast" role="status" aria-live="polite">
            <Check aria-hidden="true" />
            <span>{toast || "Exported"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
