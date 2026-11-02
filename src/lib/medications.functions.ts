import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  MEDICATION_REFERENCE,
  MEDICATION_SOURCES,
  evaluateMedicationRequest,
  guidanceState,
  medicationById,
  referenceSummary,
  type MedicationDecision,
  type MedicationEntry,
  type MedicationFactors,
} from "./medications";

const factors = z.object({
  ageYears: z.number().int().min(0).max(130).nullable(),
  pregnancy: z.enum(["no", "pregnant", "breastfeeding", "unknown"]),
  allergies: z.array(z.string().max(120)).max(30).nullable(),
  conditions: z.array(z.string().max(120)).max(30).nullable(),
  currentMedicines: z.array(z.string().max(120)).max(50).nullable(),
});

const ask = z.object({
  question: z.string().trim().min(1).max(600),
  factors,
});

export interface MedicationReferenceRow {
  id: string;
  genericName: string;
  alsoKnownAs: string[];
  indication: string;
  warnings: string[];
  contraindications: string[];
  interactions: string[];
  minimumAgeYears: number;
  reviewStatus: string;
  sources: { id: string; title: string; publisher: string; url: string; version: string }[];
}

export interface MedicationReply {
  decision: MedicationDecision;
  state: ReturnType<typeof guidanceState>;
}

export const medicationStatus = createServerFn({ method: "GET" }).handler(async () => {
  const state = guidanceState();
  return {
    state,
    version: state.referenceVersion,
    jurisdiction: state.jurisdiction,
    sources: MEDICATION_SOURCES,
    entries: MEDICATION_REFERENCE.map(
      (entry: MedicationEntry): MedicationReferenceRow => {
        const summary = referenceSummary(entry);
        return {
          id: entry.id,
          genericName: summary.genericName,
          alsoKnownAs: summary.alsoKnownAs,
          indication: summary.indication,
          warnings: summary.warnings,
          contraindications: summary.contraindications,
          interactions: summary.interactions,
          minimumAgeYears: entry.minimumAgeYears,
          reviewStatus: summary.reviewStatus,
          sources: summary.sources.map((s) => ({
            id: s.id,
            title: s.title,
            publisher: s.publisher,
            url: s.url,
            version: s.version,
          })),
        };
      },
    ),
  };
});

export const askAboutMedicine = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ask.parse(data))
  .handler(async ({ data }): Promise<MedicationReply> => {
    const { checkRateLimit, rateKey } = await import("./rateLimit.server");
    const request = getRequest();
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { optionalSupabaseUser } = await import("./serverAuth.server");
    const session = await optionalSupabaseUser();
    const state = guidanceState();
    if (!checkRateLimit(rateKey("medication", session?.userId ?? null, ip), 15, 60_000)) {
      return {
        state,
        decision: {
          kind: "refuse",
          entry: null,
          reason: "not-in-reference",
          checks: [],
          message: "Too many medicine questions in a short time. Wait a minute and try again.",
        },
      };
    }
    const decision = evaluateMedicationRequest(data.question, data.factors as MedicationFactors, {
      state,
      entries: MEDICATION_REFERENCE,
    });
    return { decision, state };
  });

/** Lookup used by the assistant route so a referenced medicine can show its card. */
export const medicationEntry = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().max(60) }).parse(data))
  .handler(async ({ data }) => {
    const entry = medicationById(data.id);
    return entry ? referenceSummary(entry) : null;
  });
