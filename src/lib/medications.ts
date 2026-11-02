/**
 * Non-prescription medicine information for the Lifeline assistant.
 *
 * Scope, deliberately narrow:
 *  - generic names only, never brands;
 *  - no doses and no dose calculation, ever;
 *  - no diagnosis, no substitution, no stopping a prescribed medicine;
 *  - an entry is only offered as an option when the approved reference covers
 *    the person's age, pregnancy/breastfeeding state, allergies, conditions and
 *    current medicines, and when the entry itself carries clinical review.
 *
 * The reference content below has NOT been clinically reviewed in this build,
 * so `guidanceState()` reports `disabled` and the assistant explains why. The
 * safety evaluation still runs: it can always escalate an emergency or refuse
 * an unsafe option, which is the part that must never wait for a review.
 */
import { detectEmergency } from "./knowledge";

export const MEDICATION_REFERENCE_VERSION = "2026.11-draft";

export type ReviewStatus = "not-clinically-reviewed" | "clinically-reviewed";

export interface MedicationSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  jurisdiction: "India" | "Global" | "United Kingdom";
  version: string;
  checkedOn: string;
  note: string;
}

export const MEDICATION_SOURCES: MedicationSource[] = [
  {
    id: "who-eml",
    title: "WHO Model List of Essential Medicines, 23rd list",
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02",
    jurisdiction: "Global",
    version: "23rd list (2023)",
    checkedOn: "2026-11-02",
    note: "Used to confirm that an ingredient is a recognised essential medicine. It is not a consumer dosing label.",
  },
  {
    id: "nhs-medicines",
    title: "Medicines A to Z",
    publisher: "National Health Service (UK)",
    url: "https://www.nhs.uk/medicines/",
    jurisdiction: "United Kingdom",
    version: "Living page, checked 2026-11-02",
    checkedOn: "2026-11-02",
    note: "Linked for consumer-level warnings. Text is not reproduced.",
  },
  {
    id: "cdsco-labels",
    title: "Drugs and Cosmetics Rules — labelling of medicines",
    publisher: "Central Drugs Standard Control Organisation, Government of India",
    url: "https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Drugs-and-Cosmetics/",
    jurisdiction: "India",
    version: "Rules as published, checked 2026-11-02",
    checkedOn: "2026-11-02",
    note: "The approved product label in the pack is the authority for use, warnings and dose.",
  },
];

export const sourceById = (id: string) => MEDICATION_SOURCES.find((s) => s.id === id);

export interface MedicationEntry {
  id: string;
  genericName: string;
  alsoKnownAs: string[];
  ingredient: string;
  indication: string;
  form: string;
  /** Minimum age the consumer label covers for self-selection. */
  minimumAgeYears: number;
  ageNote: string;
  pregnancy: "avoid" | "seek-advice";
  breastfeeding: "avoid" | "seek-advice";
  warnings: string[];
  contraindications: string[];
  /** Generic ingredient names this medicine is known to interact with. */
  interactions: string[];
  /** Conditions that make self-selection unsafe. */
  conditionsToCheck: string[];
  sourceIds: string[];
  reviewStatus: ReviewStatus;
}

export const MEDICATION_REFERENCE: MedicationEntry[] = [
  {
    id: "paracetamol",
    genericName: "Paracetamol",
    alsoKnownAs: ["acetaminophen"],
    ingredient: "paracetamol",
    indication: "Mild pain and fever in adults, as listed on the consumer label.",
    form: "Tablets and syrup; the pack label states the strength.",
    minimumAgeYears: 12,
    ageNote: "Child and infant dosing is weight-based and must come from a clinician or the child's own pack.",
    pregnancy: "seek-advice",
    breastfeeding: "seek-advice",
    warnings: [
      "Many cold and flu products already contain paracetamol; taking both can exceed the safe total.",
      "Severe or lasting pain, or a fever that will not settle, needs medical assessment rather than more medicine.",
    ],
    contraindications: ["Known allergy to paracetamol", "Severe liver disease"],
    interactions: ["warfarin", "alcohol", "carbamazepine", "phenytoin"],
    conditionsToCheck: ["liver", "kidney", "alcohol"],
    sourceIds: ["who-eml", "nhs-medicines", "cdsco-labels"],
    reviewStatus: "not-clinically-reviewed",
  },
  {
    id: "oral-rehydration-salts",
    genericName: "Oral rehydration salts",
    alsoKnownAs: ["ORS", "oral rehydration solution"],
    ingredient: "glucose and electrolyte powder",
    indication: "Fluid and salt replacement in mild dehydration from diarrhoea or vomiting.",
    form: "Sachet dissolved in the volume of clean water printed on the pack.",
    minimumAgeYears: 12,
    ageNote: "For a child, babies and older adults, dehydration needs clinical advice; the pack volume and strength differ.",
    pregnancy: "seek-advice",
    breastfeeding: "seek-advice",
    warnings: [
      "Mix with exactly the amount of water on the sachet. A stronger mix can be harmful.",
      "Blood in the stool, vomiting that will not stop, drowsiness or passing very little urine needs urgent medical help.",
    ],
    contraindications: ["Unable to drink", "Severe dehydration or shock"],
    interactions: [],
    conditionsToCheck: ["kidney", "heart failure", "diabetes"],
    sourceIds: ["who-eml", "cdsco-labels"],
    reviewStatus: "not-clinically-reviewed",
  },
  {
    id: "cetirizine",
    genericName: "Cetirizine",
    alsoKnownAs: ["cetirizine hydrochloride"],
    ingredient: "cetirizine",
    indication: "Mild hay-fever type allergy symptoms such as sneezing and itching in adults.",
    form: "Tablets; the pack label states the strength.",
    minimumAgeYears: 12,
    ageNote: "Antihistamines are not for self-selection in young children without clinical advice.",
    pregnancy: "seek-advice",
    breastfeeding: "seek-advice",
    warnings: [
      "Can cause drowsiness. Avoid driving or machinery until you know how it affects you.",
      "Trouble breathing, lip or throat swelling, or a spreading rash is an emergency, not a reason to take an antihistamine.",
    ],
    contraindications: ["Known allergy to cetirizine or hydroxyzine", "Severe kidney disease"],
    interactions: ["alcohol", "diazepam", "sleeping tablets", "opioid"],
    conditionsToCheck: ["kidney", "liver", "epilepsy"],
    sourceIds: ["nhs-medicines", "cdsco-labels"],
    reviewStatus: "not-clinically-reviewed",
  },
  {
    id: "ibuprofen",
    genericName: "Ibuprofen",
    alsoKnownAs: ["NSAID", "non-steroidal anti-inflammatory drug"],
    ingredient: "ibuprofen",
    indication: "Short-term mild pain and inflammation in adults, as listed on the consumer label.",
    form: "Tablets; the pack label states the strength.",
    minimumAgeYears: 12,
    ageNote: "Not for self-selection in children without clinical advice.",
    pregnancy: "avoid",
    breastfeeding: "seek-advice",
    warnings: [
      "Stomach pain, black stools, or vomiting blood while taking it needs urgent medical help.",
      "Ask a pharmacist before using it with any blood thinner or blood-pressure medicine.",
    ],
    contraindications: [
      "Known allergy to aspirin or other NSAIDs",
      "Stomach or duodenal ulcer",
      "Severe kidney, liver or heart failure",
      "Third trimester of pregnancy",
    ],
    interactions: ["warfarin", "aspirin", "lisinopril", "ramipril", "ibuprofen", "steroid"],
    conditionsToCheck: ["ulcer", "kidney", "liver", "heart failure", "asthma", "blood pressure"],
    sourceIds: ["nhs-medicines", "cdsco-labels"],
    reviewStatus: "not-clinically-reviewed",
  },
];

export const medicationById = (id: string) => MEDICATION_REFERENCE.find((m) => m.id === id);

export interface GuidanceState {
  enabled: boolean;
  /** Exact reason guidance cannot be offered, when disabled. */
  blocker: string | null;
  referenceVersion: string;
  jurisdiction: "India";
  reviewStatus: ReviewStatus;
}

/**
 * Guidance is only enabled when an operator turns it on AND every reference
 * entry has documented clinical review. Shipping the flag without the review
 * record still reports `disabled` — the app must never imply clinical review
 * it does not have.
 */
export function guidanceState(
  env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env,
  entries: MedicationEntry[] = MEDICATION_REFERENCE,
): GuidanceState {
  const flagged = env.MEDICATION_GUIDANCE_ENABLED === "1";
  const unreviewed = entries.filter((e) => e.reviewStatus !== "clinically-reviewed");
  const enabled = flagged && unreviewed.length === 0;
  return {
    enabled,
    blocker: enabled
      ? null
      : !flagged
        ? "Medicine suggestions are switched off on this deployment until the reference content and safety behaviour have passed qualified clinical review."
        : `${unreviewed.length} of ${entries.length} reference entries have no documented clinical review yet, so no medicine is suggested.`,
    referenceVersion: MEDICATION_REFERENCE_VERSION,
    jurisdiction: "India",
    reviewStatus: unreviewed.length === 0 ? "clinically-reviewed" : "not-clinically-reviewed",
  };
}

export interface MedicationFactors {
  ageYears: number | null;
  pregnancy: "no" | "pregnant" | "breastfeeding" | "unknown";
  /** null = the user has not told us. */
  allergies: string[] | null;
  conditions: string[] | null;
  currentMedicines: string[] | null;
}

export type RefusalReason =
  | "not-in-reference"
  | "prescription"
  | "substitution"
  | "dose"
  | "age-unknown"
  | "child"
  | "older-adult"
  | "pregnancy"
  | "allergy"
  | "interaction"
  | "condition"
  | "current-medicines-unknown"
  | "brand";

export interface MedicationMatch {
  entry: MedicationEntry;
  sources: MedicationSource[];
}

export type MedicationDecision =
  | {
      kind: "emergency";
      redFlag: string;
      message: string;
    }
  | {
      kind: "disabled";
      entry: MedicationMatch | null;
      blocker: string;
      checks: string[];
      message: string;
    }
  | {
      kind: "refuse";
      entry: MedicationMatch | null;
      reason: RefusalReason;
      message: string;
      checks: string[];
    }
  | {
      kind: "information";
      entry: MedicationMatch;
      checks: string[];
      message: string;
      /** Always label-only; the app never states a dose. */
      dosing: "label-only";
    };

const EMERGENCY_ACTIONS =
  "Call your local emergency number now. If someone is unresponsive and not breathing normally, start CPR. If they are awake but drowsy after taking too much medicine, keep them awake, keep the pack, and follow the poison-centre or emergency operator's instructions.";

const PRESCRIPTION = /\b(antibiotic|amoxicillin|azithromycin|prescription|prescribed|steroid|insulin|blood thinner)\b/i;
const SUBSTITUTION = /\b(switch|replace|substitute|instead of|stop taking|double (the )?dose|combine|mix with)\b/i;
const DOSE = /\b(dose|dosage|how (much|many)|mg|ml|milligrams?|tablets? (a|per|each) day)\b/i;

function matchEntry(question: string): MedicationMatch | null {
  const q = question.toLowerCase();
  const entry = MEDICATION_REFERENCE.find(
    (m) =>
      q.includes(m.genericName.toLowerCase()) ||
      m.alsoKnownAs.some((n) => n.length > 3 && q.includes(n.toLowerCase())),
  );
  if (!entry) return null;
  return {
    entry,
    sources: entry.sourceIds
      .map(sourceById)
      .filter((s): s is MedicationSource => Boolean(s)),
  };
}

/** Factor checks that apply to every entry, expressed as readable lines. */
function baseChecks(f: MedicationFactors, entry: MedicationEntry): string[] {
  return [
    `Age ${f.ageYears ?? "not given"} · self-selection label covers ${entry.minimumAgeYears}+`,
    `Pregnancy/breastfeeding: ${f.pregnancy}`,
    `Allergies recorded: ${f.allergies === null ? "not given" : f.allergies.join(", ") || "none"}`,
    `Conditions recorded: ${f.conditions === null ? "not given" : f.conditions.join(", ") || "none"}`,
    `Current medicines: ${f.currentMedicines === null ? "not given" : f.currentMedicines.join(", ") || "none"}`,
  ];
}

const has = (list: string[], needle: string) =>
  list.some((v) => v.toLowerCase().includes(needle.toLowerCase()));

/**
 * Evaluate one medicine question. Emergency symptoms and overdose are checked
 * first and always win, then hard refusals, then the clinical-review gate.
 * `info` is only reachable when every required factor is known and the entry
 * carries clinical review.
 */
export function evaluateMedicationRequest(
  question: string,
  factors: MedicationFactors,
  options: {
    state?: GuidanceState;
    entries?: MedicationEntry[];
  } = {},
): MedicationDecision {
  const state = options.state ?? guidanceState(undefined, options.entries);
  const emergency = detectEmergency(question);
  if (emergency.emergent) {
    return {
      kind: "emergency",
      redFlag: emergency.label ?? "a time-critical emergency",
      message: `This sounds like ${emergency.label ?? "a time-critical emergency"}. Medicine guidance comes after emergency help, never before it. ${EMERGENCY_ACTIONS}`,
    };
  }

  const match = matchEntry(question);
  const checks = match ? baseChecks(factors, match.entry) : [];

  if (!match) {
    return {
      kind: "refuse",
      entry: null,
      reason: "not-in-reference",
      checks,
      message:
        "Lifeline's non-prescription reference does not cover that medicine, so it will not suggest anything. Read the product label and ask a pharmacist or clinician.",
    };
  }
  const { entry, sources } = match;

  if (PRESCRIPTION.test(question)) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "prescription",
      checks,
      message:
        "Lifeline does not discuss prescription medicines, substitutions or stopping a prescribed medicine. Ask the prescriber or a pharmacist.",
    };
  }
  if (SUBSTITUTION.test(question)) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "substitution",
      checks,
      message:
        "Lifeline never suggests swapping, combining or stopping medicines. That decision belongs to your prescriber or pharmacist.",
    };
  }
  if (DOSE.test(question)) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "dose",
      checks,
      message: `Lifeline does not state or calculate a dose. Follow the dose printed on the product you have${
        entry.id === "paracetamol" ? " and check no other product you are taking already contains paracetamol" : ""
      }. Ask a pharmacist if the label is unclear.`,
    };
  }
  if (factors.ageYears === null) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "age-unknown",
      checks,
      message:
        "Lifeline will not suggest a medicine without the person's age, because many are unsafe for children. Read the label and ask a pharmacist or clinician.",
    };
  }
  if (factors.ageYears < entry.minimumAgeYears) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "child",
      checks,
      message: `${entry.genericName} is not offered for self-selection under ${entry.minimumAgeYears} years. ${entry.ageNote}`,
    };
  }
  if (factors.ageYears >= 75) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "older-adult",
      checks,
      message:
        "For someone aged 75 or over, medicine choices need a pharmacist or clinician who can weigh other conditions and medicines. Lifeline will not suggest one.",
    };
  }
  if (factors.pregnancy === "unknown") {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "pregnancy",
      checks,
      message:
        "Lifeline will not suggest a medicine before knowing whether the person is pregnant or breastfeeding. Ask a pharmacist or clinician.",
    };
  }
  if (factors.pregnancy !== "no" && (entry.pregnancy === "avoid" || entry.breastfeeding === "avoid")) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "pregnancy",
      checks,
      message: `${entry.genericName} is marked to avoid in pregnancy or breastfeeding by the reference. Ask the clinician caring for the pregnancy before taking anything.`,
    };
  }
  if (factors.allergies === null) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "allergy",
      checks,
      message:
        "Lifeline will not suggest a medicine without knowing the person's allergies. Read the label's ingredients and check with a pharmacist.",
    };
  }
  if (has(factors.allergies, entry.ingredient) || has(factors.allergies, entry.genericName)) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "allergy",
      checks,
      message: `A recorded allergy matches ${entry.genericName}. Do not take it; ask a pharmacist about alternatives.`,
    };
  }
  if (factors.currentMedicines === null) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "current-medicines-unknown",
      checks,
      message:
        "Lifeline will not suggest a medicine without knowing what else the person takes. List every medicine, including anything bought without a prescription, for a pharmacist.",
    };
  }
  const clash = entry.interactions.find((i) => has(factors.currentMedicines!, i));
  if (clash) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "interaction",
      checks,
      message: `A recorded medicine (${clash}) can interact with ${entry.genericName}. Ask a pharmacist before considering it.`,
    };
  }
  if (factors.conditions === null) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "condition",
      checks,
      message:
        "Lifeline will not suggest a medicine without knowing the person's health conditions. Read the label's warnings and ask a pharmacist.",
    };
  }
  const condition = entry.conditionsToCheck.find((c) => has(factors.conditions!, c));
  if (condition) {
    return {
      kind: "refuse",
      entry: { entry, sources },
      reason: "condition",
      checks,
      message: `A recorded condition (${condition}) means ${entry.genericName} needs a clinician's or pharmacist's advice rather than self-selection.`,
    };
  }
  if (!state.enabled) {
    return {
      kind: "disabled",
      entry: { entry, sources },
      blocker: state.blocker ?? "Medicine guidance is switched off on this deployment.",
      checks,
      message:
        "The reference entry and its warnings are shown below, but Lifeline is not suggesting this medicine. Read the product label and ask a pharmacist or clinician.",
    };
  }

  return {
    kind: "information",
    entry: { entry, sources },
    checks,
    dosing: "label-only",
    message: `The approved reference lists ${entry.genericName} for ${entry.indication.toLowerCase()} Follow the dose printed on your product's label and check the warnings below. Ask a pharmacist if anything is unclear.`,
  };
}

/** Reference content for display when guidance is disabled: warnings only. */
export function referenceSummary(entry: MedicationEntry) {
  return {
    genericName: entry.genericName,
    alsoKnownAs: entry.alsoKnownAs,
    indication: entry.indication,
    warnings: entry.warnings,
    contraindications: entry.contraindications,
    interactions: entry.interactions,
    sources: entry.sourceIds.map(sourceById).filter((s): s is MedicationSource => Boolean(s)),
    reviewStatus: entry.reviewStatus,
  };
}
