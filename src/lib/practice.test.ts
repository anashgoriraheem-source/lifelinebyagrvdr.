import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRACTICE_LEVELS,
  PRACTICE_SCENARIOS,
  PRACTICE_SCENARIO_COUNT,
  PRACTICE_SOURCES,
  practiceScenarioById,
} from "@/data/practice";
import {
  applyAttempt,
  buildPracticeCsv,
  levelProgress,
  safeChoiceCount,
  statusForResult,
  statusForScenario,
} from "@/lib/practice";

describe("practice curriculum", () => {
  it("has exactly ten levels with ten distinct scenarios each", () => {
    expect(PRACTICE_LEVELS).toHaveLength(10);
    expect(PRACTICE_SCENARIO_COUNT).toBe(100);
    expect(PRACTICE_SCENARIOS).toHaveLength(100);
    for (const level of PRACTICE_LEVELS) {
      expect(level.scenarios).toHaveLength(10);
      expect(level.objectives.length).toBeGreaterThanOrEqual(2);
      expect(level.summary.length).toBeGreaterThan(20);
    }
    const ids = new Set(PRACTICE_SCENARIOS.map((scenario) => scenario.id));
    expect(ids.size).toBe(100);
    const titles = new Set(PRACTICE_SCENARIOS.map((scenario) => scenario.title));
    expect(titles.size).toBe(100);
  });

  it("keeps every scenario complete, safe to teach and sourced", () => {
    const sourceIds = new Set(PRACTICE_SOURCES.map((source) => source.id));
    for (const scenario of PRACTICE_SCENARIOS) {
      expect(scenario.setting.length, scenario.id).toBeGreaterThan(20);
      expect(scenario.role.length, scenario.id).toBeGreaterThan(5);
      expect(scenario.sees.length, scenario.id).toBeGreaterThanOrEqual(2);
      expect(scenario.objective.length, scenario.id).toBeGreaterThan(10);
      expect(scenario.decisions.length, scenario.id).toBeGreaterThanOrEqual(3);
      expect(scenario.decisions.length, scenario.id).toBeLessThanOrEqual(6);

      for (const decision of scenario.decisions) {
        expect(decision.prompt.length, scenario.id).toBeGreaterThan(5);
        expect(decision.hint.length, scenario.id).toBeGreaterThan(5);
        expect(decision.options.length, scenario.id).toBeGreaterThanOrEqual(2);
        const correct = decision.options.filter((option) => option.correct);
        expect(correct, scenario.id).toHaveLength(1);
        for (const option of decision.options) {
          expect(option.label.length, scenario.id).toBeGreaterThan(5);
          expect(option.why.length, scenario.id).toBeGreaterThan(10);
        }
      }

      expect(scenario.safeSequence.length, scenario.id).toBeGreaterThanOrEqual(3);
      expect(scenario.avoid.length, scenario.id).toBeGreaterThanOrEqual(2);
      expect(["now", "if-worse", "advice"]).toContain(scenario.emergency.urgency);
      expect(scenario.emergency.note.length, scenario.id).toBeGreaterThan(10);
      expect(scenario.report.length, scenario.id).toBeGreaterThanOrEqual(2);
      expect(scenario.debrief.length, scenario.id).toBeGreaterThan(30);
      expect(scenario.sources.length, scenario.id).toBeGreaterThanOrEqual(2);
      for (const id of scenario.sources) expect(sourceIds.has(id), `${scenario.id}: ${id}`).toBe(true);

      // Nothing in this build has been clinically reviewed.
      expect(scenario.reviewStatus).toBe("awaiting-clinical-review");
      expect(scenario.reviewedOn).toBeNull();
      expect(scenario.guidanceVersion).toBe("2026.11.1");
    }
  });

  it("never teaches a dose or a diagnosis as a bystander action", () => {
    const forbidden = /\b\d+\s?(mg|ml|mcg|g)\b/i;
    for (const scenario of PRACTICE_SCENARIOS) {
      const text = JSON.stringify(scenario);
      expect(forbidden.test(text), scenario.id).toBe(false);
    }
  });

  it("looks scenarios up by id", () => {
    expect(practiceScenarioById("l1-s1")?.title).toBe("Roadside incident with moving traffic");
    expect(practiceScenarioById("l10-s10")?.level).toBe(10);
    expect(practiceScenarioById("nope")).toBeUndefined();
  });
});

describe("practice safety boundary", () => {
  const files = [
    "src/routes/practice.tsx",
    "src/components/practice/ScenarioPlayer.tsx",
    "src/components/practice/PracticeProgressTable.tsx",
  ];
  const sourceOf = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

  it("never imports a real alarm, dispatch, SOS or device path", () => {
    const forbidden = [
      'from "@/lib/sos"',
      'from "@/lib/alerts',
      'from "@/lib/dispatch',
      'from "@/lib/alertDispatch',
      'from "@/lib/store"',
      'from "@/core/ble',
      "raiseAlarm",
      "dispatchEmergency",
      "navigator.share",
      "navigator.bluetooth",
      "geolocation",
    ];
    for (const file of files) {
      const source = sourceOf(file);
      for (const needle of forbidden) {
        expect(source.includes(needle), `${file} must not use ${needle}`).toBe(false);
      }
    }
  });

  it("only offers emergency contact through a user-initiated tel link", () => {
    const source = sourceOf("src/components/practice/ScenarioPlayer.tsx");
    expect(source).toContain("href={`tel:");
    expect(source).toContain("This is not the simulation");
  });

  it("labels every scenario screen and the library as practice", () => {
    expect(sourceOf("src/routes/practice.tsx")).toContain("Practice simulation");
    expect(sourceOf("src/components/practice/ScenarioPlayer.tsx")).toContain("Practice simulation");
    expect(sourceOf("src/routes/practice.tsx")).toContain("Awaiting clinical review");
  });
});

describe("practice progress", () => {
  it("only completes a scenario when every decision was safe", () => {
    expect(statusForResult(3, 3)).toBe("completed");
    expect(statusForResult(2, 3)).toBe("review-needed");
    expect(statusForResult(0, 0)).toBe("review-needed");
  });

  it("counts safe choices from answers", () => {
    const scenario = practiceScenarioById("l1-s1")!;
    const safeIndexes = scenario.decisions.map((decision) =>
      decision.options.findIndex((option) => option.correct),
    );
    expect(safeChoiceCount(scenario.decisions, safeIndexes).safe).toBe(3);
    const unsafe = scenario.decisions.map((decision) =>
      decision.options.findIndex((option) => !option.correct),
    );
    expect(safeChoiceCount(scenario.decisions, unsafe).safe).toBe(0);
    expect(safeChoiceCount(scenario.decisions, [null, null, null]).answered).toBe(0);
  });

  it("keeps the best result and never downgrades a completed scenario", () => {
    const scenario = practiceScenarioById("l2-s1")!;
    const first = applyAttempt({}, scenario, 1);
    expect(first[scenario.id].status).toBe("review-needed");
    expect(first[scenario.id].attempts).toBe(1);
    const second = applyAttempt(first, scenario, 3);
    expect(second[scenario.id].status).toBe("completed");
    expect(second[scenario.id].bestSafe).toBe(3);
    const third = applyAttempt(second, scenario, 0);
    expect(third[scenario.id].status).toBe("completed");
    expect(third[scenario.id].attempts).toBe(3);
  });

  it("reports level progress from real records", () => {
    const level = PRACTICE_LEVELS[0];
    const scenario = level.scenarios[0];
    const progress = applyAttempt({}, scenario, scenario.decisions.length);
    const summary = levelProgress(level, progress);
    expect(summary.completed).toBe(1);
    expect(summary.notStarted).toBe(9);
    expect(summary.percent).toBe(10);
    expect(statusForScenario(scenario.id, progress)).toBe("completed");
    expect(statusForScenario("l1-s10", progress)).toBe("not-started");
  });

  it("builds a CSV with the real records and escaped cells", () => {
    const scenario = practiceScenarioById("l1-s1")!;
    const csv = buildPracticeCsv([
      {
        scenario,
        status: "completed",
        attempts: 2,
        safeChoices: 3,
        lastPractisedAt: "2026-11-03T10:00:00.000Z",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Scenario,Level,Status,Attempts,Safe choices,Decision points,Last practised");
    expect(lines[1]).toBe(
      "Roadside incident with moving traffic,1,Completed,2,3,3,2026-11-03T10:00:00.000Z",
    );
  });
});
