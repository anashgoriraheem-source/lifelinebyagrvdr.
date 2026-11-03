import type { PracticeSource } from "./model";

/**
 * Curriculum sources. Practice guidance is written in Lifeline's own words from
 * these public first-aid resources; no source text is reproduced. `reviewed` is
 * the date this repository last re-checked the source, not a clinical review of
 * the scenario.
 */
export const PRACTICE_SOURCES: PracticeSource[] = [
  {
    id: "red-cross-guidelines",
    title: "First aid guidelines and resources",
    publisher: "American Red Cross",
    url: "https://www.redcross.org/take-a-class/resources/guidelines",
    jurisdiction: "United States / global reference",
    published: null,
  },
  {
    id: "who-community-first-aid",
    title: "Community first aid and basic emergency care resources",
    publisher: "World Health Organization",
    url: "https://www.who.int/teams/integrated-health-services/clinical-services-and-systems/emergency--critical-and-operative-care/essential-resources-for-emergency--critical-and-operative-care",
    jurisdiction: "Global",
    published: null,
  },
  {
    id: "ifrc-first-aid",
    title: "International First Aid, Resuscitation and Education Guidelines",
    publisher: "IFRC Global First Aid Reference Centre",
    url: "https://www.globalfirstaidcentre.org/international-first-aid-resuscitation-and-education-guidelines/",
    jurisdiction: "Global",
    published: "2020",
  },
  {
    id: "erss-112",
    title: "Emergency Response Support System (ERSS 112)",
    publisher: "Ministry of Home Affairs, Government of India",
    url: "https://112.gov.in/",
    jurisdiction: "India",
    published: null,
  },
];

export const practiceSourceById = (id: string) =>
  PRACTICE_SOURCES.find((source) => source.id === id);
