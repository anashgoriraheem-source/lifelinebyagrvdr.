import { level1 } from "./level1";
import { level2 } from "./level2";
import { level3 } from "./level3";
import { level4 } from "./level4";
import { level5 } from "./level5";
import { level6 } from "./level6";
import { level7 } from "./level7";
import { level8 } from "./level8";
import { level9 } from "./level9";
import { level10 } from "./level10";
import type { PracticeLevel, PracticeScenario } from "./model";

export * from "./model";
export * from "./sources";

/** Exactly ten levels, ten scenarios each. `practice.test.ts` enforces both. */
export const PRACTICE_LEVELS: PracticeLevel[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
];

export const PRACTICE_SCENARIOS: PracticeScenario[] = PRACTICE_LEVELS.flatMap(
  (level) => level.scenarios,
);

/**
 * Scenarios hidden from learners (for example while an editor reworks one after
 * a content error). Withholding is independent of clinical review status: an
 * unreviewed scenario is shown with an "awaiting review" label, while a listed
 * id is removed from the player and shown as withheld in the progress table.
 */
export const WITHHELD_SCENARIO_IDS: string[] = [];

export const PRACTICE_SCENARIO_COUNT = PRACTICE_SCENARIOS.length;
export const PRACTICE_LEVEL_COUNT = PRACTICE_LEVELS.length;

export const practiceScenarioById = (id: string) =>
  PRACTICE_SCENARIOS.find((scenario) => scenario.id === id);

export const practiceLevelByNumber = (level: number) =>
  PRACTICE_LEVELS.find((entry) => entry.level === level);
