import type { PracticeDecision, PracticeLevel, PracticeScenario } from "@/data/practice";

/**
 * Practice Mode progress. Only what the learner needs is stored: one record per
 * scenario with the attempt count, the best number of safe choices, the status
 * and when it was last practised. No patient data, no answers, no scores shared
 * with anyone else.
 */

export type PracticeStatus = "not-started" | "completed" | "review-needed";

/** A row can also be withheld from learners while its review is pending. */
export type PracticeRowStatus = PracticeStatus | "withheld";

export interface PracticeProgress {
  scenarioId: string;
  attempts: number;
  bestSafe: number;
  totalDecisions: number;
  status: Exclude<PracticeStatus, "not-started">;
  lastPractisedAt: string;
}

export type PracticeProgressMap = Record<string, PracticeProgress>;

export const PRACTICE_STORAGE_KEY = "lifeline:practice:v1";
export const PRACTICE_SESSION_KEY = "lifeline:practice:session:v1";

export const STATUS_LABEL: Record<PracticeRowStatus, string> = {
  "not-started": "Not started",
  completed: "Completed",
  "review-needed": "Review needed",
  withheld: "Withheld",
};

/** A scenario counts as completed only when every decision chose the safe option. */
export function statusForResult(safeChoices: number, totalDecisions: number): "completed" | "review-needed" {
  return totalDecisions > 0 && safeChoices >= totalDecisions ? "completed" : "review-needed";
}

export function safeChoiceCount(decisions: PracticeDecision[], answers: (number | null)[]) {
  let safe = 0;
  let answered = 0;
  decisions.forEach((decision, i) => {
    const chosen = answers[i];
    if (chosen === null || chosen === undefined) return;
    answered += 1;
    if (decision.options[chosen]?.correct) safe += 1;
  });
  return { safe, answered, total: decisions.length };
}

export function statusForScenario(
  scenarioId: string,
  progress: PracticeProgressMap,
): PracticeStatus {
  return progress[scenarioId]?.status ?? "not-started";
}

export interface LevelProgress {
  level: number;
  total: number;
  completed: number;
  reviewNeeded: number;
  notStarted: number;
  /** Completed scenarios as a percentage of the level. */
  percent: number;
}

export function levelProgress(level: PracticeLevel, progress: PracticeProgressMap): LevelProgress {
  let completed = 0;
  let reviewNeeded = 0;
  for (const scenario of level.scenarios) {
    const status = statusForScenario(scenario.id, progress);
    if (status === "completed") completed += 1;
    else if (status === "review-needed") reviewNeeded += 1;
  }
  const total = level.scenarios.length;
  return {
    level: level.level,
    total,
    completed,
    reviewNeeded,
    notStarted: total - completed - reviewNeeded,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function overallProgress(levels: PracticeLevel[], progress: PracticeProgressMap) {
  let completed = 0;
  let reviewNeeded = 0;
  let total = 0;
  for (const level of levels) {
    const summary = levelProgress(level, progress);
    total += summary.total;
    completed += summary.completed;
    reviewNeeded += summary.reviewNeeded;
  }
  return { total, completed, reviewNeeded, notStarted: total - completed - reviewNeeded };
}

/** The next scenario the learner should open in a level. */
export function nextScenario(level: PracticeLevel, progress: PracticeProgressMap): PracticeScenario {
  return (
    level.scenarios.find((scenario) => statusForScenario(scenario.id, progress) === "review-needed") ??
    level.scenarios.find((scenario) => statusForScenario(scenario.id, progress) === "not-started") ??
    level.scenarios[0]
  );
}

export function readLocalProgress(): PracticeProgressMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PracticeProgressMap;
  } catch {
    return {};
  }
}

export function writeLocalProgress(progress: PracticeProgressMap) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* Storage may be full or blocked; the in-memory progress still works. */
  }
}

export interface PracticeAnswersSession {
  scenarioId: string;
  answers: (number | null)[];
  step: number;
  hintShown: boolean;
}

export function readSession(): PracticeAnswersSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRACTICE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PracticeAnswersSession;
    if (!parsed?.scenarioId || !Array.isArray(parsed.answers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: PracticeAnswersSession | null) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!session) localStorage.removeItem(PRACTICE_SESSION_KEY);
    else localStorage.setItem(PRACTICE_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* Ignore storage failures; practice still works in the open tab. */
  }
}

export function applyAttempt(
  progress: PracticeProgressMap,
  scenario: PracticeScenario,
  safe: number,
): PracticeProgressMap {
  const previous = progress[scenario.id];
  const status = statusForResult(safe, scenario.decisions.length);
  const current = previous?.status === "completed" ? previous : undefined;
  const bestSafe = Math.max(previous?.bestSafe ?? 0, safe);
  const finalStatus =
    current || (previous && bestSafe >= scenario.decisions.length)
      ? "completed"
      : status;
  return {
    ...progress,
    [scenario.id]: {
      scenarioId: scenario.id,
      attempts: (previous?.attempts ?? 0) + 1,
      bestSafe,
      totalDecisions: scenario.decisions.length,
      status: finalStatus,
      lastPractisedAt: new Date().toISOString(),
    },
  };
}

export interface PracticeCsvRow {
  scenario: PracticeScenario;
  status: PracticeRowStatus;
  attempts: number;
  safeChoices: number;
  lastPractisedAt: string | null;
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Builds the CSV the progress table exports and downloads. */
export function buildPracticeCsv(rows: PracticeCsvRow[]): string {
  const header = [
    "Scenario",
    "Level",
    "Status",
    "Attempts",
    "Safe choices",
    "Decision points",
    "Last practised",
  ];
  const body = rows.map((row) =>
    [
      row.scenario.title,
      row.scenario.level,
      STATUS_LABEL[row.status],
      row.attempts,
      row.safeChoices,
      row.scenario.decisions.length,
      row.lastPractisedAt ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function practiceExportFilename(now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `lifeline-practice-progress-${date}.csv`;
}

/** Browser-only: hands the CSV to the user as a real download. */
export function downloadCsv(csv: string, filename: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
