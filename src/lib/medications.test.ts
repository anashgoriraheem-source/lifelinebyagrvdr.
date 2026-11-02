import { describe, expect, it } from "vitest";
import {
  MEDICATION_REFERENCE,
  evaluateMedicationRequest,
  guidanceState,
  type MedicationFactors,
} from "./medications";

const adult: MedicationFactors = {
  ageYears: 34,
  pregnancy: "no",
  allergies: ["penicillin"],
  conditions: ["asthma"],
  currentMedicines: ["amlodipine"],
};

/** A state where every entry claims documented clinical review, so the
 *  factor checks can be exercised independently of the shipping gate. */
const reviewedState = guidanceState({ MEDICATION_GUIDANCE_ENABLED: "1" }, [
  ...MEDICATION_REFERENCE.map((e) => ({ ...e, reviewStatus: "clinically-reviewed" as const })),
]);
const reviewed = { state: reviewedState };

describe("medication guidance safeguards", () => {
  it("is disabled until every reference entry has documented clinical review", () => {
    const off = guidanceState({});
    expect(off.enabled).toBe(false);
    expect(off.reviewStatus).toBe("not-clinically-reviewed");
    expect(off.blocker).toMatch(/clinical review/i);

    // The env flag alone must not enable unreviewed content.
    const flagged = guidanceState({ MEDICATION_GUIDANCE_ENABLED: "1" });
    expect(flagged.enabled).toBe(false);
    expect(flagged.blocker).toMatch(/no documented clinical review/i);

    const reviewedEntries = MEDICATION_REFERENCE.map((e) => ({
      ...e,
      reviewStatus: "clinically-reviewed" as const,
    }));
    expect(guidanceState({ MEDICATION_GUIDANCE_ENABLED: "1" }, reviewedEntries).enabled).toBe(true);
  });

  it("puts emergency symptoms and overdose ahead of any medicine talk", () => {
    const chest = evaluateMedicationRequest("which painkiller for crushing chest pain?", adult);
    expect(chest.kind).toBe("emergency");
    if (chest.kind === "emergency") expect(chest.message).toMatch(/Call your local emergency number/);

    const overdose = evaluateMedicationRequest("I took too many paracetamol tablets", adult);
    expect(overdose.kind).toBe("emergency");

    const poisoning = evaluateMedicationRequest("my child swallowed poison, give paracetamol?", adult);
    expect(poisoning.kind).toBe("emergency");

    const anaphylaxis = evaluateMedicationRequest("throat swelling after ibuprofen, should I take cetirizine?", adult);
    expect(anaphylaxis.kind).toBe("emergency");
  });

  it("never states a dose, prescription choice, substitution or brand", () => {
    for (const question of [
      "what dose of paracetamol should I take?",
      "how many ibuprofen tablets per day",
      "should I stop taking my prescribed medicine and use paracetamol?",
      "can I replace my antibiotic with paracetamol?",
    ]) {
      const decision = evaluateMedicationRequest(question, adult, reviewed);
      expect(decision.kind).toBe("refuse");
    }
    const dose = evaluateMedicationRequest("paracetamol dose", adult, reviewed);
    expect(JSON.stringify(dose)).not.toMatch(/\b\d+\s?(mg|ml|tablet)/i);
  });

  it("refuses when age, allergies, conditions or current medicines are unknown", () => {
    const unknownAge = evaluateMedicationRequest("can I take paracetamol", { ...adult, ageYears: null }, reviewed);
    expect(unknownAge.kind === "refuse" && unknownAge.reason).toBe("age-unknown");

    const unknownAllergies = evaluateMedicationRequest("can I take paracetamol", { ...adult, allergies: null }, reviewed);
    expect(unknownAllergies.kind === "refuse" && unknownAllergies.reason).toBe("allergy");

    const unknownMeds = evaluateMedicationRequest("can I take paracetamol", { ...adult, currentMedicines: null }, reviewed);
    expect(unknownMeds.kind === "refuse" && unknownMeds.reason).toBe("current-medicines-unknown");

    const unknownConditions = evaluateMedicationRequest("can I take paracetamol", { ...adult, conditions: null }, reviewed);
    expect(unknownConditions.kind === "refuse" && unknownConditions.reason).toBe("condition");
  });

  it("refuses for children, pregnancy, allergies, interactions and organ conditions", () => {
    const child = evaluateMedicationRequest("paracetamol for my fever", { ...adult, ageYears: 6 }, reviewed);
    expect(child.kind === "refuse" && child.reason).toBe("child");

    const pregnant = evaluateMedicationRequest("ibuprofen for back pain", { ...adult, pregnancy: "pregnant" }, reviewed);
    expect(pregnant.kind === "refuse" && pregnant.reason).toBe("pregnancy");

    const unknownPregnancy = evaluateMedicationRequest("can I take ibuprofen", { ...adult, pregnancy: "unknown" }, reviewed);
    expect(unknownPregnancy.kind === "refuse" && unknownPregnancy.reason).toBe("pregnancy");

    const allergy = evaluateMedicationRequest("paracetamol for headache", { ...adult, allergies: ["Paracetamol"] }, reviewed);
    expect(allergy.kind === "refuse" && allergy.reason).toBe("allergy");

    const interaction = evaluateMedicationRequest("paracetamol for headache", { ...adult, currentMedicines: ["Warfarin 5mg"] }, reviewed);
    expect(interaction.kind === "refuse" && interaction.reason).toBe("interaction");

    const liver = evaluateMedicationRequest("paracetamol for headache", { ...adult, conditions: ["Chronic liver disease"] }, reviewed);
    expect(liver.kind === "refuse" && liver.reason).toBe("condition");

    const kidney = evaluateMedicationRequest("ibuprofen for knee pain", { ...adult, conditions: ["Chronic kidney disease"] }, reviewed);
    expect(kidney.kind === "refuse" && kidney.reason).toBe("condition");

    const older = evaluateMedicationRequest("paracetamol for headache", { ...adult, ageYears: 81 }, reviewed);
    expect(older.kind === "refuse" && older.reason).toBe("older-adult");
  });

  it("only offers label-only information when every factor is known and reviewed", () => {
    const decision = evaluateMedicationRequest(
      "can I take paracetamol for a mild headache",
      { ageYears: 34, pregnancy: "no", allergies: ["penicillin"], conditions: ["asthma"], currentMedicines: ["amlodipine"] },
      reviewed,
    );
    expect(decision.kind).toBe("information");
    if (decision.kind === "information") {
      expect(decision.dosing).toBe("label-only");
      expect(decision.message).toMatch(/label/i);
      expect(decision.entry.sources.length).toBeGreaterThan(0);
    }
  });

  it("still refuses an unknown medicine and keeps sources attached", () => {
    const unknown = evaluateMedicationRequest("can I take ranitidine", adult, reviewed);
    expect(unknown.kind === "refuse" && unknown.reason).toBe("not-in-reference");
    const entry = evaluateMedicationRequest("paracetamol", { ...adult, allergies: null }, reviewed);
    if (entry.kind === "refuse") {
      expect(entry.entry?.sources.length).toBeGreaterThan(0);
      expect(entry.entry?.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
    }
  });
});
