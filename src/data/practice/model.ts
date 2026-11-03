/**
 * Practice Mode scenario model.
 *
 * Content is authored as structured data so an editor can change a scenario,
 * its sources or its review state without touching page code. Every scenario is
 * written for an ordinary bystander: scene safety, early emergency activation,
 * basic care while waiting, reassessment and clear communication. There are no
 * medication doses, diagnoses or clinical procedures.
 *
 * REVIEW STATE: nothing in this build has been reviewed by a clinician or a
 * recognised first-aid educator. Every scenario therefore carries
 * `reviewStatus: "awaiting-clinical-review"` and a null review date. Do not
 * change that until a named reviewer has signed the content off.
 */

export const PRACTICE_GUIDANCE_VERSION = "2026.11.1";

export type ReviewStatus = "awaiting-clinical-review" | "clinically-reviewed";

export type EmergencyUrgency = "now" | "if-worse" | "advice";

export interface PracticeSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  jurisdiction: string;
  published: string | null;
}

export interface PracticeOption {
  label: string;
  correct: boolean;
  /** Plain-language consequence of this choice, shown straight after it. */
  why: string;
}

export interface PracticeDecision {
  prompt: string;
  hint: string;
  options: PracticeOption[];
}

export interface UnsafeAction {
  action: string;
  why: string;
}

export interface PracticeEmergency {
  urgency: EmergencyUrgency;
  /** Scenario-specific trigger. The local number is filled in by the interface. */
  note: string;
}

export interface DraftScenario {
  title: string;
  setting: string;
  role: string;
  sees: string[];
  objective: string;
  decisions: PracticeDecision[];
  safeSequence: string[];
  avoid: UnsafeAction[];
  emergency: PracticeEmergency;
  report: string[];
  debrief: string;
  sources: string[];
}

export interface PracticeScenario extends DraftScenario {
  id: string;
  level: number;
  index: number;
  guidanceVersion: string;
  reviewStatus: ReviewStatus;
  reviewedOn: string | null;
}

export interface DraftLevel {
  level: number;
  title: string;
  summary: string;
  objectives: string[];
  scenarios: DraftScenario[];
}

export interface PracticeLevel {
  level: number;
  title: string;
  summary: string;
  objectives: string[];
  scenarios: PracticeScenario[];
}

export const o = (label: string, correct: boolean, why: string): PracticeOption => ({
  label,
  correct,
  why,
});

export const d = (
  prompt: string,
  hint: string,
  ...options: PracticeOption[]
): PracticeDecision => ({ prompt, hint, options });

export const avoid = (action: string, why: string): UnsafeAction => ({ action, why });

export function buildLevel(draft: DraftLevel): PracticeLevel {
  return {
    level: draft.level,
    title: draft.title,
    summary: draft.summary,
    objectives: draft.objectives,
    scenarios: draft.scenarios.map((scenario, i) => ({
      ...scenario,
      id: `l${draft.level}-s${i + 1}`,
      level: draft.level,
      index: i + 1,
      guidanceVersion: PRACTICE_GUIDANCE_VERSION,
      reviewStatus: "awaiting-clinical-review",
      reviewedOn: null,
    })),
  };
}
