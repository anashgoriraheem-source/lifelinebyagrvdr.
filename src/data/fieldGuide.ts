import { guideById } from "@/lib/firstAid";

/**
 * The shelf in `FieldGuideMegaMenu` is a catalogue over the first-aid guides we
 * already ship — nothing here is invented. A topic carries only what the guide
 * itself states: its title, how many steps it has, and whether it tells the
 * reader to call emergency services before doing anything else.
 */
export interface GuideTopic {
  id: string;
  title: string;
  steps: number;
  /** `always` = call the emergency number before anything else. */
  call: "always" | "if-severe";
}

export interface GuideCategory {
  id: string;
  label: string;
  topics: GuideTopic[];
}

export type GuideDepartmentId = "urgent" | "injury" | "conditions";

export interface GuideDepartment {
  id: GuideDepartmentId;
  label: string;
  /** Column heading above the topic list. */
  sub: string;
  /** Link under the topic list. */
  all: string;
  categories: GuideCategory[];
  /** Guide shown in the three-dimensional handbook. */
  featuredId: string;
}

const topic = (id: string): GuideTopic | null => {
  const guide = guideById(id);
  if (!guide) return null;
  return { id: guide.id, title: guide.title, steps: guide.steps.length, call: guide.call };
};

const category = (id: string, label: string, ids: string[]): GuideCategory => ({
  id,
  label,
  topics: ids.map(topic).filter((t): t is GuideTopic => t !== null),
});

export const GUIDE_DEPARTMENTS: GuideDepartment[] = [
  {
    id: "urgent",
    label: "Life-threatening",
    sub: "Topics",
    all: "Open every life-threatening guide",
    categories: [
      category("breathing", "Not breathing", ["cpr"]),
      category("airway", "Choking & allergy", ["choking", "allergy"]),
      category("heart-brain", "Chest & brain", ["chest-pain", "stroke"]),
      category("oxygen", "Breathing & poison", ["breathing", "poisoning"]),
    ],
    featuredId: "cpr",
  },
  {
    id: "injury",
    label: "Injury & collapse",
    sub: "Topics",
    all: "Open every injury and collapse guide",
    categories: [
      category("bleeding", "Heavy bleeding", ["bleeding"]),
      category("burns", "Burns", ["burns"]),
      category("falls", "Falls & head injury", ["fall", "fainting"]),
      category("seizure", "Seizure & shock", ["seizure", "shock"]),
    ],
    featuredId: "bleeding",
  },
  {
    id: "conditions",
    label: "Daily conditions",
    sub: "Topics",
    all: "Open every daily-condition guide",
    categories: [
      category("low-sugar", "Low blood sugar", ["low-sugar"]),
      category("high-sugar", "High blood sugar", ["high-sugar"]),
      category("pressure", "Blood pressure & pulse", ["high-bp", "heart-racing"]),
      category("heat", "Heat & dehydration", ["heat"]),
    ],
    featuredId: "low-sugar",
  },
];

/** Every catalogued topic, in shelf order. */
export const GUIDE_TOPICS: GuideTopic[] = GUIDE_DEPARTMENTS.flatMap((department) =>
  department.categories.flatMap((c) => c.topics),
);

/** Topics whose guide says to call the emergency number before anything else. */
export const CALL_FIRST_COUNT = GUIDE_TOPICS.filter((t) => t.call === "always").length;

export const guideTopicById = (id: string) => GUIDE_TOPICS.find((t) => t.id === id);
