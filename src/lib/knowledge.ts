import { GUIDES, matchGuide } from "./firstAid";
import { HEALTH_SOURCES, type HealthSource } from "@/data/health-sources";
import { normaliseAssistantRequest } from "./assistantLanguages";
export interface PersonalContext {
  signedIn: boolean;
  name?: string;
  age: number | null;
  bloodType?: string;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  contacts: {
    name: string;
    relationship: string;
    sms: boolean;
    call: boolean;
    email: boolean;
    confirmed: boolean;
  }[];
  readings: {
    key: string;
    label: string;
    value: string;
    unit: string;
    source: string;
    measuredAt: number;
    quality: "good" | "uncertain" | "stale";
    stale: boolean;
  }[];
  incidents: { reason: string; status: string; startedAt: string }[];
}
export interface AssistantAnswer {
  status: "answered" | "unavailable";
  provider: "library" | "model";
  escalate: boolean;
  text: string;
  sources: HealthSource[];
  groundedIn: ("profile" | "contacts" | "readings" | "incidents")[];
  languageFallback: boolean;
  limitation?: string;
  guideId?: string;
}
/** Conservative keyword escalation, not triage or diagnosis. Never a proof
 * that unrecognised symptoms are safe. Keep urgent actions outside chat. */
export function detectEmergency(text: string) {
  const q = normaliseAssistantRequest(text, "hi").toLowerCase();
  const emergent =
    /chest pain|not breathing|cannot breathe|can.t breathe|unconscious|unresponsive|stroke|severe bleeding|overdose|too many .*tablets|poison|throat swelling|suicid|kill myself|सीने में दर्द|सांस नहीं|बेहोश|ज़हर|जहर|आत्महत्या/.test(
      q,
    );
  return { emergent, label: emergent ? "a possible emergency" : undefined };
}
export const retrieveKnowledge = (question: string) => ({
  guide: matchGuide(question),
  sources: HEALTH_SOURCES.filter((s) => s.id === "ifrc-first-aid"),
});
export function answerFromLibrary(
  question: string,
  _context: PersonalContext,
  options: { formatTime: (t: number) => string; language: string; languageName: string },
): AssistantAnswer {
  const emergency = detectEmergency(question),
    guide = matchGuide(question);
  const urgent =
    "Call your local emergency number now and ask a nearby capable person to help. Do not wait for this software. Follow the emergency operator’s instructions.";
  return {
    status: "answered",
    provider: "library",
    escalate: emergency.emergent,
    text:
      (emergency.emergent ? urgent + "\n\n" : "") +
      (guide
        ? `${guide.title}\n${guide.intro}\n${guide.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : "I am software, not a clinician. I cannot diagnose or confirm that you are safe. For a health concern, contact a qualified clinician. Use the emergency call controls for urgent symptoms."),
    sources: guide ? retrieveKnowledge(question).sources : [],
    groundedIn: [],
    languageFallback: options.language !== "en",
    guideId: guide?.id,
    limitation:
      "Draft English first-aid information; clinical and jurisdiction review not completed. Hindi safety translations have not been approved. No AI provider or help delivery is configured.",
  };
}
export const buildModelContext = (_q: string, _c: PersonalContext, _r: unknown, _o: unknown) =>
  "Generative medical answers are disabled pending review.";
export const unacceptableModelAnswer = (_text: string) => true;
export const libraryGuideCount = GUIDES.length;
