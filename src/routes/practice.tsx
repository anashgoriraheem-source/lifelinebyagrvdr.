import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  GraduationCap,
  Info,
  Phone,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { ScenarioPlayer } from "@/components/practice/ScenarioPlayer";
import { PracticeProgressTable } from "@/components/practice/PracticeProgressTable";
import { Button } from "@/components/ui/button";
import {
  PRACTICE_GUIDANCE_VERSION,
  PRACTICE_LEVELS,
  PRACTICE_SCENARIOS,
  PRACTICE_SCENARIO_COUNT,
  PRACTICE_SOURCES,
  WITHHELD_SCENARIO_IDS,
  practiceLevelByNumber,
  practiceScenarioById,
} from "@/data/practice";
import { EMERGENCY_BY_COUNTRY } from "@/lib/fixtures";
import { useApp } from "@/hooks/useApp";
import {
  applyAttempt,
  buildPracticeCsv,
  downloadCsv,
  levelProgress,
  nextScenario,
  overallProgress,
  practiceExportFilename,
  readLocalProgress,
  readSession,
  statusForScenario,
  writeLocalProgress,
  writeSession,
  type PracticeAnswersSession,
  type PracticeCsvRow,
  type PracticeProgressMap,
} from "@/lib/practice";
import {
  exportPracticeCsv,
  listPracticeProgress,
  recordPracticeAttempt,
  resetPracticeProgress,
} from "@/lib/practice.functions";

interface PracticeSearch {
  level?: number;
  scenario?: string;
}

export const Route = createFileRoute("/practice")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): PracticeSearch => {
    const level = Number(search.level);
    const scenario = typeof search.scenario === "string" ? search.scenario : undefined;
    return {
      level: Number.isInteger(level) && level >= 1 && level <= 10 ? level : undefined,
      scenario: scenario && practiceScenarioById(scenario) ? scenario : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Practice mode · Lifeline" },
      {
        name: "description",
        content:
          "Practise 100 first-aid and emergency-awareness scenarios across ten levels. Educational simulation only — not certified training and never a real emergency call.",
      },
      { property: "og:title", content: "Practice mode · Lifeline" },
      {
        property: "og:description",
        content:
          "Ten levels of first-aid decision practice. Simulation only — nothing here contacts emergency services.",
      },
    ],
  }),
  component: PracticePage,
});

const withheld = new Set(WITHHELD_SCENARIO_IDS);

function PracticePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/practice" });
  const userId = useApp((state) => state.userId);
  const countryCode = useApp((state) => state.countryCode);
  const emergency = EMERGENCY_BY_COUNTRY[countryCode] ?? EMERGENCY_BY_COUNTRY.IN;

  const loadProgress = useServerFn(listPracticeProgress);
  const saveAttempt = useServerFn(recordPracticeAttempt);
  const resetProgress = useServerFn(resetPracticeProgress);
  const exportProgress = useServerFn(exportPracticeCsv);

  const [progress, setProgress] = useState<PracticeProgressMap>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [session, setSession] = useState<PracticeAnswersSession | null>(() => readSession());
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProgress(readLocalProgress());
      setStatus("ready");
      setError("");
      return;
    }
    setStatus("loading");
    loadProgress()
      .then((records) => {
        if (!active) return;
        setProgress(records);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setError("Your saved progress could not be loaded. Practice still works and will save again when you reconnect.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [userId, loadProgress]);

  const levels = PRACTICE_LEVELS;
  const overall = useMemo(() => overallProgress(levels, progress), [levels, progress]);
  const selectedLevel = search.level ? practiceLevelByNumber(search.level) : undefined;
  const selectedScenario = search.scenario ? practiceScenarioById(search.scenario) : undefined;

  const tableRows: PracticeCsvRow[] = useMemo(
    () =>
      PRACTICE_SCENARIOS.map((scenario) => {
        const record = progress[scenario.id];
        return {
          scenario,
          status: withheld.has(scenario.id)
            ? "withheld"
            : statusForScenario(scenario.id, progress),
          attempts: record?.attempts ?? 0,
          safeChoices: record?.bestSafe ?? 0,
          lastPractisedAt: record?.lastPractisedAt ?? null,
        };
      }),
    [progress],
  );

  const persistAttempt = useCallback(
    async (scenarioId: string, safe: number) => {
      const scenario = practiceScenarioById(scenarioId);
      if (!scenario) return;
      if (userId) {
        const updated = await saveAttempt({ data: { scenarioId, safeChoices: safe } });
        setProgress((previous) => ({ ...previous, [scenarioId]: updated }));
        return;
      }
      setProgress((previous) => {
        const next = applyAttempt(previous, scenario, safe);
        writeLocalProgress(next);
        return next;
      });
    },
    [saveAttempt, userId],
  );

  const handleExport = useCallback(
    async (_scope: "all" | "selected", ids: string[]) => {
      const wanted = ids
        .map((id) => practiceScenarioById(id))
        .filter((scenario): scenario is NonNullable<typeof scenario> => Boolean(scenario));
      if (!wanted.length) return 0;

      let records = progress;
      if (userId) {
        const rows = await exportProgress({ data: { scenarioIds: ids } });
        records = { ...progress };
        for (const row of rows) records[row.scenarioId] = row;
      }

      const csvRows: PracticeCsvRow[] = wanted.map((scenario) => {
        const record = records[scenario.id];
        return {
          scenario,
          status: withheld.has(scenario.id) ? "withheld" : statusForScenario(scenario.id, records),
          attempts: record?.attempts ?? 0,
          safeChoices: record?.bestSafe ?? 0,
          lastPractisedAt: record?.lastPractisedAt ?? null,
        };
      });
      downloadCsv(buildPracticeCsv(csvRows), practiceExportFilename());
      return csvRows.length;
    },
    [exportProgress, progress, userId],
  );

  const handleReset = async () => {
    if (
      !window.confirm(
        "Reset all practice progress? Completed and review-needed marks will be cleared. This cannot be undone.",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      if (userId) await resetProgress();
      setProgress({});
      writeLocalProgress({});
      writeSession(null);
      setSession(null);
    } finally {
      setResetting(false);
    }
  };

  const openScenario = (scenarioId: string) => {
    const scenario = practiceScenarioById(scenarioId);
    if (!scenario || withheld.has(scenarioId)) return;
    writeSession(null);
    setSession(null);
    void navigate({
      search: (previous) => ({ ...previous, level: scenario.level, scenario: scenarioId }),
    });
  };

  const closeScenario = () => {
    // Pausing keeps the saved place so the learner can resume where they stopped.
    // A completed scenario clears it itself through onSessionChange.
    void navigate({ search: (previous) => ({ ...previous, scenario: undefined }) });
  };

  const resumeScenarioNow = (scenarioId: string) => {
    const scenario = practiceScenarioById(scenarioId);
    if (!scenario) return;
    void navigate({ search: { level: scenario.level, scenario: scenarioId } });
  };

  const goToLevel = (level: number) => {
    void navigate({ search: { level, scenario: undefined } });
  };

  const sessionScenario =
    session?.scenarioId && !withheld.has(session.scenarioId)
      ? practiceScenarioById(session.scenarioId)
      : null;

  if (selectedScenario) {
    const level = practiceLevelByNumber(selectedScenario.level);
    const summary = level ? levelProgress(level, progress) : null;
    const next = level
      ? level.scenarios.find(
          (scenario) =>
            scenario.index > selectedScenario.index && !withheld.has(scenario.id),
        )
      : undefined;
    return (
      <main id="main-content" tabIndex={-1} className="pb-28">
        <ScenarioPlayer
          key={selectedScenario.id}
          scenario={selectedScenario}
          initialSession={sessionScenario?.id === selectedScenario.id ? session : null}
          emergencyNumber={emergency?.general ?? ""}
          jurisdictionLabel={emergency?.country ?? "your country"}
          levelCompleted={Boolean(summary && summary.completed >= summary.total)}
          nextTitle={next?.title ?? null}
          onSessionChange={(value) => {
            writeSession(value);
            setSession(value);
          }}
          onExit={closeScenario}
          onComplete={(scenario, safe) => persistAttempt(scenario.id, safe)}
          onRepeat={() => writeSession(null)}
          onNext={() => {
            if (next) openScenario(next.id);
          }}
        />
      </main>
    );
  }

  const resumeScenario = sessionScenario;

  return (
    <main id="main-content" tabIndex={-1} className="pb-28">
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6" aria-labelledby="practice-heading">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <GraduationCap className="size-3.5" aria-hidden="true" />
            Practice simulation
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-warning/50 bg-warning-soft px-3 py-1 text-xs font-semibold">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Awaiting clinical review
          </span>
          <span className="text-xs text-muted-foreground">Guidance version {PRACTICE_GUIDANCE_VERSION}</span>
        </div>

        <h1 id="practice-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
          Practice mode
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          Work through 100 short scenarios in ten levels, from spotting danger and calling for help
          to combining safe priorities in complex situations. Every choice gets an explanation. There
          is no timer and no speed score.
        </p>

        <div className="mt-4 grid gap-3 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm leading-relaxed sm:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              Educational practice only
            </p>
            <p className="mt-1 text-muted-foreground">
              This is not medical advice, a clinical assessment, a substitute for emergency services,
              or a CPR or first-aid certificate. Nothing in practice mode starts an SOS, calls or
              messages anyone, shares your location, sounds a Bluetooth alarm or contacts emergency
              services. Guidance is written for {emergency?.country ?? "your selected country"}; the
              emergency number comes from the country chosen in Contacts.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-critical px-4 py-2 text-sm font-semibold text-destructive-foreground"
              href={`tel:${(emergency?.general ?? "112").replace(/[^\d+]/g, "")}`}
            >
              <Phone className="size-4" aria-hidden="true" />
              Real emergency: {emergency?.general ?? "112"}
            </a>
            <Link to="/contacts" className="text-xs underline underline-offset-4">
              Change country and number in Contacts
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-lg font-semibold">
                {status === "loading" ? "Loading progress…" : `${overall.completed} of ${PRACTICE_SCENARIO_COUNT} completed`}
              </p>
              <p className="text-sm text-muted-foreground">
                {overall.reviewNeeded} to review · {overall.notStarted} not started
              </p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Overall practice progress"
              aria-valuemin={0}
              aria-valuemax={PRACTICE_SCENARIO_COUNT}
              aria-valuenow={overall.completed}
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${(overall.completed / PRACTICE_SCENARIO_COUNT) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {userId
                ? "Progress is saved privately to your account."
                : "You are signed out, so progress is saved in this browser only."}{" "}
              {!userId ? (
                <Link to="/account" className="underline underline-offset-4">
                  Sign in to keep it
                </Link>
              ) : null}
            </p>
            {error ? (
              <p className="mt-2 text-xs text-critical" role="status">
                {error}
              </p>
            ) : null}
          </div>
          <Button variant="outline" onClick={() => void handleReset()} disabled={resetting || status === "loading"}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset progress
          </Button>
        </div>

        {resumeScenario ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/50 bg-accent p-4">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm">
              You paused <span className="font-semibold">{resumeScenario.title}</span> at decision{" "}
              {(session?.step ?? 0) + 1}. Your place was kept.
            </p>
            <Button onClick={() => resumeScenarioNow(resumeScenario.id)}>
              Resume scenario
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <section className="mt-8" aria-labelledby="levels-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="levels-heading" className="text-xl font-bold">
                Ten levels, ten scenarios each
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Difficulty grows from recognising danger and asking for help to combining safe
                priorities in multi-step situations.
              </p>
            </div>
            {selectedLevel ? (
              <Button variant="ghost" onClick={() => void navigate({ search: { level: undefined, scenario: undefined } })}>
                Show all levels
              </Button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {levels.map((level) => {
              const summary = levelProgress(level, progress);
              const active = selectedLevel?.level === level.level;
              return (
                <div
                  key={level.level}
                  className={`rounded-xl border p-4 transition ${
                    active ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Level {level.level}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {status === "loading" ? "…" : `${summary.completed}/10`}
                    </span>
                  </div>
                  <h3 className="mt-1 font-display text-base font-bold">{level.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{level.summary}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-success"
                      style={{ width: `${summary.percent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {summary.reviewNeeded ? `${summary.reviewNeeded} to review` : "Practice only"}
                    </span>
                    <Button size="sm" variant={active ? "default" : "outline"} onClick={() => goToLevel(level.level)}>
                      Open level
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {selectedLevel ? (
          <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="level-heading">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Level {selectedLevel.level}
            </p>
            <h2 id="level-heading" className="mt-1 text-xl font-bold">
              {selectedLevel.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{selectedLevel.summary}</p>
            <div className="mt-3">
              <p className="text-sm font-semibold">Learning objectives</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
                {selectedLevel.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => openScenario(nextScenario(selectedLevel, progress).id)}>
                <ClipboardList className="size-4" aria-hidden="true" />
                Start or review this level
              </Button>
            </div>

            <ul className="mt-4 grid gap-2">
              {selectedLevel.scenarios.map((scenario) => {
                const state = withheld.has(scenario.id)
                  ? "withheld"
                  : statusForScenario(scenario.id, progress);
                return (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-start transition hover:border-primary/60"
                      onClick={() => openScenario(scenario.id)}
                      disabled={state === "withheld"}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold">
                        {scenario.index}
                      </span>
                      <span className="min-w-40 flex-1">
                        <span className="block text-sm font-medium">{scenario.title}</span>
                        <span className="block text-xs text-muted-foreground">{scenario.objective}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          state === "completed"
                            ? "bg-success-soft text-success"
                            : state === "review-needed"
                              ? "bg-warning-soft text-primary"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {state === "completed" ? (
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        ) : state === "review-needed" ? (
                          <CircleHelp className="size-3.5" aria-hidden="true" />
                        ) : null}
                        {state === "completed"
                          ? "Completed"
                          : state === "review-needed"
                            ? "Review needed"
                            : state === "withheld"
                              ? "Withheld"
                              : "New"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-8" aria-labelledby="progress-table-heading">
          <h2 id="progress-table-heading" className="sr-only">
            Practice progress by scenario
          </h2>
          <PracticeProgressTable
            rows={tableRows}
            loading={status === "loading"}
            onOpen={openScenario}
            onExport={handleExport}
          />
        </section>

        <section className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2" aria-labelledby="sources-heading">
          <div>
            <h2 id="sources-heading" className="flex items-center gap-2 text-lg font-bold">
              <BookOpen className="size-5" aria-hidden="true" />
              Curriculum sources
            </h2>
            <ul className="mt-2 space-y-2 text-sm">
              {PRACTICE_SOURCES.map((source) => (
                <li key={source.id}>
                  <a
                    className="text-primary underline underline-offset-4"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {source.title}
                  </a>
                  <span className="block text-xs text-muted-foreground">
                    {source.publisher} · {source.jurisdiction}
                    {source.published ? ` · ${source.published}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm leading-relaxed">
            <h2 className="font-semibold">Review status</h2>
            <p className="mt-1 text-muted-foreground">
              All {PRACTICE_SCENARIO_COUNT} scenarios are labelled{" "}
              <strong className="text-foreground">awaiting clinical review</strong>. Guidance version{" "}
              {PRACTICE_GUIDANCE_VERSION}; review date: not reviewed. A qualified clinician or
              recognised first-aid educator has not signed off this content, so it is not presented
              as certified training. Completing practice never certifies competence.
            </p>
            <p className="mt-2 text-muted-foreground">
              For hands-on skills such as CPR, AED use and bleeding control, take an instructor-led
              course and practise on a manikin. Practice mode only rehearses decisions.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
