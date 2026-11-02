/**
 * Source register for the assistant's health information.
 *
 * Only titles, publishers, links and review state are stored here. Guidance in
 * this repository is written in our own words; no source text is reproduced, so
 * no source licence is implicated beyond linking.
 *
 * `reviewed` is deliberately null where this build has not re-checked the
 * source. The assistant UI must show that state rather than inventing a date.
 */
export interface HealthSource {  id: string;
  title: string;
  publisher: string;
  url: string;
  /** Jurisdiction the guidance is written for. */
  jurisdiction: "India" | "Global" | "United Kingdom";
  /** Publication or edition year, when known. */
  published: string | null;
  /** ISO date this repository last re-checked the source; null when unchecked. */
  reviewed: string | null;
  rights: string;
}

export const HEALTH_SOURCES: HealthSource[] = [
  {
    id: "ifrc-first-aid",
    title: "International First Aid, Resuscitation and Education Guidelines",
    publisher: "International Federation of Red Cross and Red Crescent Societies",
    url: "https://www.globalfirstaidcentre.org/international-first-aid-resuscitation-and-education-guidelines/",
    jurisdiction: "Global",
    published: "2020",
    reviewed: null,
    rights: "Linked only; lay-rescuer steps in Lifeline are paraphrased, not reproduced.",
  },
  {
    id: "who-cvd",
    title: "Cardiovascular diseases — fact sheet",
    publisher: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)",
    jurisdiction: "Global",
    published: null,
    reviewed: null,
    rights: "Linked only; summary written in our own words.",
  },
  {
    id: "who-diabetes",
    title: "Diabetes — fact sheet",
    publisher: "World Health Organization",
    url: "https://www.who.int/news-room/fact-sheets/detail/diabetes",
    jurisdiction: "Global",
    published: null,
    reviewed: null,
    rights: "Linked only; summary written in our own words.",
  },
  {
    id: "nhs-conditions",
    title: "Health A to Z — conditions and first aid",
    publisher: "National Health Service (UK)",
    url: "https://www.nhs.uk/conditions/",
    jurisdiction: "United Kingdom",
    published: null,
    reviewed: null,
    rights: "Linked only; no NHS text is reproduced.",
  },
  {
    id: "indian-red-cross",
    title: "First aid information",
    publisher: "Indian Red Cross Society",
    url: "https://www.indianredcross.org/",
    jurisdiction: "India",
    published: null,
    reviewed: null,
    rights: "Linked only; no Society text is reproduced.",
  },
  {
    id: "mohfw-health",
    title: "National health programmes and public health information",
    publisher: "Ministry of Health and Family Welfare, Government of India",
    url: "https://mohfw.gov.in/",
    jurisdiction: "India",
    published: null,
    reviewed: null,
    rights: "Linked only.",
  },
  {
    id: "telemanas",
    title: "Tele-MANAS mental health support",
    publisher: "Ministry of Health and Family Welfare, Government of India",
    url: "https://telemanas.mohfw.gov.in/",
    jurisdiction: "India",
    published: null,
    reviewed: null,
    rights: "Linked only.",
  },
  {
    id: "aiims-poison",
    title: "Poison information and toxicology services",
    publisher: "All India Institute of Medical Sciences",
    url: "https://www.aiims.edu/",
    jurisdiction: "India",
    published: null,
    reviewed: null,
    rights: "Linked only.",
  },
];

export const sourceById = (id: string) => HEALTH_SOURCES.find((s) => s.id === id);

/**
 * Version stamp for the assistant's knowledge base. The library is versioned
 * in the repository and edited only by a reviewed change — a model response
 * can never rewrite it. `lastChecked` records when the links were last
 * verified, not when a clinician reviewed the wording.
 */
export const KNOWLEDGE_BASE = {
  version: "2026.11",
  lastChecked: "2026-11-02",
  reviewStatus: "not-clinically-reviewed" as const,
  note: "Health-library entries are paraphrased from the listed public-health sources and versioned with the app. They have not been clinically reviewed in this build.",
};

export const knowledgeBaseSummary = () => ({
  version: KNOWLEDGE_BASE.version,
  lastChecked: KNOWLEDGE_BASE.lastChecked,
  reviewStatus: KNOWLEDGE_BASE.reviewStatus,
  note: KNOWLEDGE_BASE.note,
  sources: HEALTH_SOURCES.map((s) => ({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    jurisdiction: s.jurisdiction,
    published: s.published,
    reviewed: s.reviewed,
  })),
});
