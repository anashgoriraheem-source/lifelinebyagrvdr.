import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Phone,
  HeartPulse,
  ShieldAlert,
  Flame,
  Train,
  ShieldCheck,
  GraduationCap,
  Banknote,
  Scale,
  PawPrint,
  Zap,
  Globe,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import intentModel from "../data/saath-intent-model.json";
import multilingualPhrases from "../data/saath-multilingual-phrases.json";
import { AssistantChat } from "@/components/AssistantChat";

export const Route = createFileRoute("/saath")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saath helpline directory · AAPDA SETU" },
      {
        name: "description",
        content:
          "Find Indian helplines with the uploaded on-device multilingual situation matcher.",
      },
      { property: "og:title", content: "Saath helpline directory · AAPDA SETU" },
      {
        property: "og:description",
        content:
          "A multilingual directory for finding relevant Indian support services. Entries require official verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Saath,
});

type Helpline = {
  number: string;
  name: string;
  purpose: string;
  keywords: string;
  urgent?: boolean;
};
const HELPLINES: Helpline[] = [
  {
    number: "0120-6619540",
    name: "National Scholarship Portal Helpdesk",
    purpose: "Technical support for scholarship applications and stipend tracking",
    keywords: "scholarship student education fellowship stipend application portal",
  },
  {
    number: "1060",
    name: "Organ Retrieval Banking Organisation (AIIMS)",
    purpose: "Information and coordination for organ donation processes",
    keywords: "organ donation donor transplant retrieval registry",
  },
  {
    number: "112",
    name: "Unified Emergency Response",
    purpose: "Immediate life-threatening emergency; police, fire or medical help",
    keywords:
      "urgent emergency danger injured medical ambulance police fire rescue help now accident",
    urgent: true,
  },
  {
    number: "101",
    name: "Fire and Rescue Services",
    purpose: "Building fires, rescue, structural collapse or hazardous accidents",
    keywords: "fire smoke burning trapped collapse rescue flames gas fire brigade",
  },
  {
    number: "103",
    name: "Traffic Police Help Desk",
    purpose: "Road blocks, malfunctioning traffic signals and congestion",
    keywords: "traffic jam blocked road signal parking congestion road block",
  },
  {
    number: "104",
    name: "State Health Information & Support",
    purpose: "Health information, symptom guidance and health service updates",
    keywords: "health medical advice symptoms doctor consultation hospital",
  },
  {
    number: "1064 / 1031",
    name: "Anti-Corruption & Vigilance",
    purpose: "Report bribery, extortion or corruption by public officials",
    keywords: "bribe corruption public official extortion vigilance",
  },
  {
    number: "1066 / 1800-11-6117",
    name: "National Poison Control Centre (AIIMS)",
    purpose: "Advice after accidental ingestion of chemicals, plants or toxic substances",
    keywords: "poison swallowed chemical toxic substance overdose poisoning ingestion",
  },
  {
    number: "1070",
    name: "Relief Commissioner — Natural Calamities",
    purpose: "Relief coordination and aid during large-scale natural disasters",
    keywords: "disaster relief calamity flood cyclone earthquake aid",
  },
  {
    number: "1071",
    name: "Air Accident Emergency Helpline",
    purpose: "Information and survivor coordination after an aviation crash",
    keywords: "plane aircraft aviation crash flight accident",
  },
  {
    number: "1072",
    name: "Train Accident Information",
    purpose: "Passenger casualty updates and family support after railway accidents",
    keywords: "train railway accident derailment passenger rail",
  },
  {
    number: "1073",
    name: "Road Accident Assistance",
    purpose: "Assistance for road and highway crashes",
    keywords: "road car bike truck crash collision highway accident",
  },
  {
    number: "1033",
    name: "National Highway Helpline",
    purpose:
      "Highway assistance and reporting problems on national highways. Fuel delivery is not guaranteed; ask the operator what help is available at your location.",
    keywords:
      "highway roadside breakdown vehicle stopped car bike truck fuel petrol diesel empty tank ran out of fuel no petrol no diesel need fuel stranded puncture towing road assistance highway help",
  },
  {
    number: "1075",
    name: "National Health / Disease Information",
    purpose: "Disease outbreak, vaccine information and public health cluster reports",
    keywords: "epidemic contagious disease outbreak vaccine infection pandemic",
  },
  {
    number: "1077",
    name: "District Disaster Control Room",
    purpose: "District-level disaster updates, evacuation and shelter coordination",
    keywords: "district flood evacuation shelter disaster local emergency",
  },
  {
    number: "1078",
    name: "National Disaster Management Authority",
    purpose: "National disaster alerts and mitigation information",
    keywords: "disaster national alert mitigation earthquake flood",
  },
  {
    number: "1090",
    name: "Anti-Terrorism / Anti-Sabotage Alert",
    purpose: "Report suspicious items or potential national security threats",
    keywords: "suspicious object bomb terror sabotage security threat",
  },
  {
    number: "1091",
    name: "Women’s Safety Helpline",
    purpose: "Support for women facing harassment or safety threats",
    keywords: "woman women harassment obscene calls safety stalking threat",
  },
  {
    number: "1092",
    name: "Disaster Mitigation / Earthquake Guidance",
    purpose: "Earthquake preparedness and structural safety guidance",
    keywords: "earthquake building cracks structural safety tremor",
  },
  {
    number: "1096",
    name: "Natural Disaster Emergency Control Room",
    purpose: "Disaster monitoring and search-and-rescue coordination",
    keywords: "natural disaster rescue cyclone flood landslide",
  },
  {
    number: "1097",
    name: "National AIDS Control Organisation",
    purpose: "Confidential HIV/AIDS information, testing and treatment support",
    keywords: "HIV AIDS testing sexual health antiretroviral",
  },
  {
    number: "1098",
    name: "Childline India",
    purpose: "Children in distress, abuse, exploitation, trafficking or unsafe situations",
    keywords: "child children minor abuse child labour trafficking runaway unsafe",
  },
  {
    number: "1363 / 1800-11-1363",
    name: "Tourist Helpline",
    purpose: "Travel information and safety assistance for tourists",
    keywords: "tourist visitor travel lost traveller tourism",
  },
  {
    number: "139",
    name: "Railway Helpline",
    purpose: "Railway travel issues, onboard security, theft or passenger assistance",
    keywords: "train railway theft ticket passenger security station",
  },
  {
    number: "14416",
    name: "Tele-MANAS Mental Health Support",
    purpose: "Confidential mental-health counselling and emotional support",
    keywords:
      "mental health anxiety panic stress depressed emotional distress counselling overwhelmed",
  },
  {
    number: "14427",
    name: "National Transgender Helpline",
    purpose: "Support and guidance for transgender citizens",
    keywords: "transgender identity card discrimination support",
  },
  {
    number: "14433",
    name: "National Human Rights Commission",
    purpose: "Complaints about serious human-rights violations",
    keywords: "human rights abuse custodial violence rights complaint",
  },
  {
    number: "14434",
    name: "Workers’ Help Desk",
    purpose: "Support for unorganised, migrant and construction workers",
    keywords: "worker migrant labour wage construction workplace safety",
  },
  {
    number: "14440",
    name: "RBI Missed Call Fraud Alert",
    purpose: "Guidance on securing banking channels after suspected digital fraud",
    keywords: "bank fraud UPI scam money stolen digital payment account hacked",
  },
  {
    number: "14448",
    name: "RBI Banking Grievance Helpline",
    purpose: "Unresolved banking disputes, hidden charges or faulty digital banking",
    keywords: "bank complaint transaction dispute charges loan banking",
  },
  {
    number: "14456",
    name: "National Anti-Drug Abuse Helpline",
    purpose: "Support, counselling access and information about de-addiction services",
    keywords: "drug abuse addiction substance deaddiction rehabilitation",
  },
  {
    number: "14456",
    name: "Disability Support Helpline",
    purpose: "Disability-related certificates, accessibility and benefit support",
    keywords: "disability disabled accessibility divyangjan certificate benefits",
  },
  {
    number: "14567",
    name: "Elderline — Senior Citizens",
    purpose: "Support for senior citizens, including neglect and legal assistance",
    keywords: "elderly old person senior citizen abandoned neglect",
  },
  {
    number: "15100",
    name: "National Legal Services Authority",
    purpose: "Free legal aid and legal consultation",
    keywords: "lawyer legal aid court legal advice rights",
  },
  {
    number: "1551 / 1800-180-1551",
    name: "Kisan Call Centre",
    purpose: "Farm advice, crop problems and agricultural information",
    keywords: "farmer crop disease agriculture farming fertilizer",
  },
  {
    number: "155255 / 1800-425-4732",
    name: "IRDAI Insurance Helpline",
    purpose: "Insurance claim and policy grievances",
    keywords: "insurance claim rejected policy motor health insurance",
  },
  {
    number: "155333",
    name: "Electricity Supply Complaints",
    purpose: "Power outages, damaged transformers or dangerous electrical wires",
    keywords: "electricity power cut blackout fallen wire transformer shock",
  },
  {
    number: "1800-102-7282",
    name: "Dhwani Crisis Support",
    purpose: "Crisis support and intervention for queer and transgender survivors of violence",
    keywords: "LGBTQ queer transgender violence survivor crisis support",
  },
  {
    number: "1800-11-0031",
    name: "Alcoholism & Drug De-addiction Support",
    purpose: "Confidential advice and rehabilitation service information",
    keywords: "addiction alcohol drugs substance rehab family support",
  },
  {
    number: "1800-11-2100",
    name: "FSSAI Food Safety Help Desk",
    purpose: "Complaints about contaminated food, unhygienic eateries or food fraud",
    keywords: "food poisoning contaminated food restaurant hygiene food safety",
  },
  {
    number: "1800-180-5522",
    name: "National Anti-Ragging Helpline",
    purpose: "Report ragging, bullying or hazing in educational institutions",
    keywords: "ragging bullying college school harassment senior students",
  },
  {
    number: "1800-22-7575 / 1800-266-7575",
    name: "SEBI Investor Helpline",
    purpose: "Capital-market scams, broker fraud or demat account issues",
    keywords: "stock market trading broker fraud investment demat scam",
  },
  {
    number: "1800-11-7800",
    name: "MyGov Mann Ki Baat Suggestion Line",
    purpose: "Submit policy feedback and suggestions",
    keywords: "government suggestion feedback civic idea",
  },
  {
    number: "1800-180-1111",
    name: "Pradhan Mantri Jan Dhan Yojana Help Line",
    purpose: "Financial inclusion and basic bank account scheme support",
    keywords: "bank account Jan Dhan financial inclusion insurance",
  },
  {
    number: "1800-258-1800",
    name: "Passport Seva Customer Service",
    purpose: "Passport applications, tracking and appointment queries",
    keywords: "passport application travel document appointment",
  },
  {
    number: "1800-425-1213",
    name: "Poison Information Centre (CMC Vellore)",
    purpose: "Toxicology advice for bites, medicine overdose or industrial poisoning",
    keywords: "poison overdose venomous bite snakebite toxic exposure",
  },
  {
    number: "1800-599-0019",
    name: "Kiran Mental Health Support",
    purpose: "Mental-health counselling and rehabilitation information",
    keywords: "mental health distress anxiety depression counselling",
  },
  {
    number: "181",
    name: "Women’s Domestic Violence Helpline",
    purpose: "Support for domestic abuse, protection and shelter information",
    keywords: "domestic violence abuse woman unsafe home protection shelter",
  },
  {
    number: "1906",
    name: "LPG Gas Leak Emergency",
    purpose: "Report a domestic LPG cylinder or gas leak",
    keywords: "gas leak LPG cylinder smell gas kitchen explosion",
  },
  {
    number: "1910",
    name: "Blood Bank Availability Information",
    purpose: "Information about blood-bank availability",
    keywords: "blood donor blood bank urgent blood type",
  },
  {
    number: "1911",
    name: "Dial-A-Doctor Consultation",
    purpose: "Basic medical consultation information",
    keywords: "doctor consultation medical advice sick symptoms",
  },
  {
    number: "1800-425-4732",
    name: "IRDAI Insurance Regulatory Helpline",
    purpose: "Insurance claim and policy grievance support",
    keywords: "insurance policy claim",
  },
  {
    number: "1912",
    name: "Electricity Grid Complaints",
    purpose: "Power supply faults, meter problems and circuit failures",
    keywords: "power supply meter electrical outage circuit",
  },
  {
    number: "1915",
    name: "National Consumer Helpline",
    purpose: "Consumer complaints, e-commerce refunds and misleading advertisements",
    keywords: "consumer complaint online shopping refund product fraud",
  },
  {
    number: "1916",
    name: "Municipal Water Supply Helpline",
    purpose: "Water disruption, contaminated drinking water and broken water mains",
    keywords: "water supply contamination dirty water sewer pipe",
  },
  {
    number: "1918",
    name: "Telecom Circuits Fault Booking",
    purpose: "Report leased telecom circuit and network hardware faults",
    keywords: "telecom network circuit outage infrastructure phone line",
  },
  {
    number: "1919",
    name: "Eye Bank and Organ Donation Registry",
    purpose: "Eye-bank coordination and organ donation registry information",
    keywords: "eye bank cornea donation organ donation registry",
  },
  {
    number: "1930",
    name: "National Cyber Crime / Financial Fraud",
    purpose: "Report online financial fraud and suspected UPI scams promptly",
    keywords: "cybercrime online scam UPI fraud bank transfer phishing hacked account",
  },
  {
    number: "1933",
    name: "MANAS Narcotics Helpline",
    purpose: "Report narcotics-related information",
    keywords: "narcotics drug trafficking illegal drugs",
  },
  {
    number: "198",
    name: "BSNL/MTNL Telecom Complaint",
    purpose: "Legacy public telecom line and broadband service complaints",
    keywords: "BSNL MTNL landline broadband internet telecom billing",
  },
  {
    number: "1947",
    name: "UIDAI Aadhaar Enquiries",
    purpose: "Aadhaar enrolment, correction and biometric-lock queries",
    keywords: "Aadhaar UIDAI biometric identity card update",
  },
  {
    number: "1950",
    name: "Voter Helpline",
    purpose: "Voter registration and voter-card enquiries",
    keywords: "voter election voter ID registration polling",
  },
  {
    number: "1962",
    name: "Animal Rescue & Veterinary Helpline",
    purpose: "Injured animals, veterinary support and livestock emergencies",
    keywords: "animal injured dog cow pet veterinary livestock rescue",
  },
  {
    number: "1964",
    name: "Central Vigilance Commission",
    purpose: "Report corruption concerning central government services",
    keywords: "corruption government vigilance complaint",
  },
  {
    number: "7827170170",
    name: "National Commission for Women Help Desk",
    purpose: "Complaints about gender discrimination and women’s safety concerns",
    keywords: "women discrimination dowry harassment workplace",
  },
  {
    number: "8882133897",
    name: "Psychosocial Support for Transgender Persons",
    purpose: "Psychosocial support and counselling information",
    keywords: "transgender counselling mental health psychosocial support",
  },
];
const normalise = (s: string) => {
  let text = s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Common real-world spelling and Hinglish variants, normalised before both rules and model inference.
  const aliases: Array<[RegExp, string]> = [
    [/\b(khatm|khtm|khatam|khtam)\b/g, "khatam"],
    [/\b(petrol|petral|patrol)\b/g, "petrol"],
    [/\b(gaddi|gadi|gaadi)\b/g, "gaadi"],
    [/\b(vehical|vechile)\b/g, "vehicle"],
    [/\b(brekdown|breakdwn)\b/g, "breakdown"],
    [/\b(ambulnce|ambalance)\b/g, "ambulance"],
    [/\b(breathng|brething)\b/g, "breathing"],
    [/\b(accidnt|accidentt)\b/g, "accident"],
    [/\b(fule|feul)\b/g, "fuel"],
    [/\b(strnded|stranded)\b/g, "stranded"],
    [/\b(paisa|paise)\b/g, "paise"],
    [/\b(bijli)\b/g, "electricity"],
  ];
  for (const [pattern, replacement] of aliases) text = text.replace(pattern, replacement);
  return text;
};
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "you",
  "your",
  "i",
  "am",
  "is",
  "on",
  "at",
  "to",
  "of",
  "a",
  "an",
  "my",
  "me",
  "we",
  "our",
  "it",
  "in",
  "with",
  "please",
  "need",
  "help",
  "there",
  "have",
  "has",
  "been",
  "being",
  "was",
  "were",
  "someone",
  "something",
  "this",
  "that",
  "what",
  "happened",
  "im",
  "ive",
  "its",
  "got",
  "get",
  "can",
  "could",
  "just",
  "now",
]);
const tokenise = (s: string) =>
  normalise(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

// A locally executed Multinomial Naive Bayes intent model trained on 90,000 synthetic utterances across 18 language options.
// It is a small text classifier, not a generative AI model or a substitute for emergency dispatch.
type ModelShape = {
  version: number;
  classes: string[];
  vocabulary: Record<string, number>;
  classLogPrior: number[];
  featureLogProb: number[][];
  totalTrainingSimulations: number;
  trainingSimulationsPerLocale: number;
  locales: string[];
  ngramMin: number;
  ngramMax: number;
};
type MultilingualPhrasePack = Record<string, Record<string, string[]>>;
const phrasePacks = multilingualPhrases as MultilingualPhrasePack;
const trainedModel = intentModel as ModelShape;
const INTENT_TO_NUMBERS: Record<string, string[]> = {
  roadside_fuel: ["1033", "1073"],
  medical_emergency: ["112", "104"],
  fire_gas: ["112", "101"],
  road_crash: ["112", "1073", "1033"],
  poisoning: ["112", "1066 / 1800-11-6117"],
  cyber_fraud: ["1930", "14440"],
  women_safety: ["112", "1091"],
  mental_health: ["14416"],
  animal_rescue: ["1962"],
  railway: ["139", "1072"],
  electricity: ["155333", "1912"],
  water: ["1916"],
  telecom: ["198"],
  banking: ["14448"],
  child_safety: ["1098", "112"],
  disaster: ["1070", "1077", "1078"],
};
function trainedIntent(query: string) {
  const text = normalise(query);
  if (!text) return { intent: "", confidence: 0 };
  // The deployed model uses character n-grams (2–5 chars), which tolerate many typos
  // and work across Latin, Cyrillic, Arabic, Devanagari, Kannada, Malayalam, Odia,
  // Assamese, Chinese, Japanese, and Korean scripts.
  const features = new Set<string>();
  for (let size = trainedModel.ngramMin ?? 2; size <= (trainedModel.ngramMax ?? 5); size++) {
    for (let i = 0; i <= text.length - size; i++) features.add(text.slice(i, i + size));
  }
  const scores = trainedModel.classes
    .map((intent, classIndex) => {
      let score = trainedModel.classLogPrior[classIndex] ?? 0;
      const logProbs = trainedModel.featureLogProb[classIndex] ?? [];
      for (const feature of features) {
        const featureIndex = trainedModel.vocabulary[feature];
        if (featureIndex !== undefined) score += logProbs[featureIndex] ?? 0;
      }
      return { intent, score };
    })
    .sort((a, b) => b.score - a.score);
  const max = scores[0]?.score ?? 0;
  const exps = scores.map((x) => Math.exp(Math.max(-40, x.score - max)));
  const total = exps.reduce((sum, n) => sum + n, 0) || 1;
  const confidence = (exps[0] ?? 0) / total;
  return { intent: confidence >= 0.2 ? (scores[0]?.intent ?? "") : "", confidence };
}
function multilingualPhraseIntent(query: string) {
  const q = normalise(query);
  if (!q) return "";
  let best: { intent: string; length: number } | undefined;
  for (const pack of Object.values(phrasePacks)) {
    for (const [intent, phrases] of Object.entries(pack)) {
      for (const phrase of phrases) {
        const candidate = normalise(phrase);
        if (
          candidate.length >= 4 &&
          q.includes(candidate) &&
          (!best || candidate.length > best.length)
        ) {
          best = { intent, length: candidate.length };
        }
      }
    }
  }
  return best?.intent ?? "";
}

type IntentRule = {
  id: string;
  phrases: string[];
  terms: string[];
  helplineNumbers: string[];
  boost: number;
};
const INTENT_RULES: IntentRule[] = [
  {
    id: "roadside_fuel",
    phrases: [
      "fuel has ended",
      "fuel ended",
      "ran out of fuel",
      "out of fuel",
      "no fuel",
      "need fuel",
      "petrol finished",
      "petrol ended",
      "petrol ran out",
      "no petrol",
      "diesel finished",
      "no diesel",
      "empty tank",
      "tank is empty",
      "car stopped on road",
      "stranded on road",
      "stuck on highway",
      "vehicle broke down",
      "bike broke down",
      "roadside assistance",
      "car wont start",
      "vehicle wont move",
    ],
    terms: [
      "fuel",
      "petrol",
      "diesel",
      "gasoline",
      "stranded",
      "breakdown",
      "puncture",
      "towing",
      "roadside",
      "highway",
      "vehicle",
      "car",
      "bike",
      "motorcycle",
      "tank",
      "empty",
      "stopped",
    ],
    helplineNumbers: ["1033", "1073"],
    boost: 35,
  },
  {
    id: "medical_emergency",
    phrases: [
      "need an ambulance",
      "someone collapsed",
      "not breathing",
      "cannot breathe",
      "cant breathe",
      "having chest pain",
      "badly injured",
      "unconscious person",
      "serious accident",
    ],
    terms: [
      "ambulance",
      "injured",
      "injury",
      "unconscious",
      "breathing",
      "bleeding",
      "medical",
      "collapse",
      "collapsed",
      "seizure",
      "chest",
      "heart",
    ],
    helplineNumbers: ["112", "104"],
    boost: 30,
  },
  {
    id: "fire_gas",
    phrases: [
      "house is on fire",
      "building on fire",
      "smell smoke",
      "gas cylinder leaking",
      "gas leak",
    ],
    terms: ["fire", "smoke", "burning", "flames", "blaze", "cylinder", "leaking", "leak"],
    helplineNumbers: ["112", "101"],
    boost: 30,
  },
  {
    id: "road_crash",
    phrases: [
      "road accident",
      "car crash",
      "bike crash",
      "someone got hit",
      "vehicle collision",
      "hit and run",
    ],
    terms: ["crash", "collision", "accident", "hit", "overturned", "injured"],
    helplineNumbers: ["112", "1073", "1033"],
    boost: 28,
  },
  {
    id: "poisoning",
    phrases: [
      "swallowed poison",
      "drank cleaning liquid",
      "swallowed chemicals",
      "ate something poisonous",
      "chemical in mouth",
    ],
    terms: [
      "poison",
      "swallowed",
      "chemical",
      "overdose",
      "toxic",
      "cleaner",
      "bleach",
      "detergent",
    ],
    helplineNumbers: ["112", "1066 / 1800-11-6117"],
    boost: 30,
  },
  {
    id: "cyber_fraud",
    phrases: [
      "money stolen online",
      "upi scam",
      "someone scammed me",
      "bank account hacked",
      "online payment fraud",
    ],
    terms: ["scam", "fraud", "upi", "phishing", "hacked", "stolen", "cybercrime", "otp"],
    helplineNumbers: ["1930", "14440"],
    boost: 30,
  },
  {
    id: "women_safety",
    phrases: [
      "being followed",
      "someone is stalking me",
      "unsafe walking alone",
      "facing harassment",
    ],
    terms: ["harassed", "harassment", "stalking", "unsafe", "abuse", "threatened", "followed"],
    helplineNumbers: ["112", "1091"],
    boost: 28,
  },
  {
    id: "mental_health",
    phrases: [
      "having a panic attack",
      "feeling overwhelmed",
      "need someone to talk to",
      "mental health support",
    ],
    terms: ["anxious", "panic", "stressed", "depressed", "overwhelmed", "counselling", "lonely"],
    helplineNumbers: ["14416"],
    boost: 25,
  },
  {
    id: "animal_rescue",
    phrases: [
      "injured dog",
      "injured cow",
      "animal hit by car",
      "animal hit by vehicle",
      "cat got hit by a car",
      "dog got hit by a car",
      "pet got hit by car",
      "stray animal injured",
      "hurt animal on road",
      "cat was hit by a vehicle",
      "dog was hit by a vehicle",
    ],
    terms: [
      "animal",
      "dog",
      "cat",
      "cow",
      "pet",
      "veterinary",
      "livestock",
      "kitten",
      "puppy",
      "stray",
    ],
    helplineNumbers: ["1962"],
    boost: 32,
  },
  {
    id: "banking",
    phrases: [
      "bank charged me twice",
      "charged twice for the same transfer",
      "duplicate bank transaction",
      "money deducted twice",
      "wrong bank charges",
      "bank transfer dispute",
    ],
    terms: [
      "bank",
      "transaction",
      "charged",
      "charges",
      "transfer",
      "deducted",
      "duplicate",
      "refund",
    ],
    helplineNumbers: ["14448", "14440"],
    boost: 28,
  },
  {
    id: "disaster",
    phrases: [
      "floodwater entering our house",
      "floodwater is entering our house",
      "flood water entering home",
      "water is flooding my home",
      "flood in my street",
      "earthquake damaged our home",
      "need shelter after a storm",
    ],
    terms: [
      "flood",
      "floodwater",
      "earthquake",
      "cyclone",
      "storm",
      "evacuation",
      "shelter",
      "disaster",
    ],
    helplineNumbers: ["1070", "1077", "1078"],
    boost: 28,
  },
];
function phraseHit(q: string, phrase: string) {
  return ` ${q} `.includes(` ${normalise(phrase)} `);
}
function score(
  item: Helpline,
  query: string,
  prediction: ReturnType<typeof trainedIntent>,
  phraseIntent: string,
) {
  const q = normalise(query);
  if (!q) return 0;
  const tokens = [...new Set(tokenise(query))];
  const nameTokens = new Set(tokenise(item.name));
  const purposeTokens = new Set(tokenise(item.purpose));
  const keywordTokens = new Set(tokenise(item.keywords));
  let value = 0;
  for (const word of tokens) {
    if (keywordTokens.has(word)) value += 4;
    if (nameTokens.has(word)) value += 3;
    if (purposeTokens.has(word)) value += 2;
  }
  if (normalise(item.name).includes(q) || normalise(item.purpose).includes(q)) value += 5;

  // High-precision phrase rules override a conflicting model guess; this prevents confident but wrong matches.
  const matchedRule = INTENT_RULES.find((rule) =>
    rule.phrases.some((phrase) => phraseHit(q, phrase)),
  );
  const animalContext =
    /\b(cat|dog|cow|kitten|puppy|pet|animal|stray)\b/.test(q) &&
    /\b(hit|hurt|injured|wounded|rescue|bleeding|run over)\b/.test(q);
  const effectiveIntent = animalContext
    ? "animal_rescue"
    : (matchedRule?.id ?? (phraseIntent || prediction.intent));
  const trainedNumbers = INTENT_TO_NUMBERS[effectiveIntent] ?? [];
  if (effectiveIntent && trainedNumbers.includes(item.number))
    value += 55 + Math.round(prediction.confidence * 20);
  else if (
    effectiveIntent &&
    /bsnl|broadband|telecom|internet/.test(normalise(item.name + " " + item.keywords)) &&
    effectiveIntent !== "telecom"
  )
    value = Math.max(0, value - 20);

  for (const rule of INTENT_RULES) {
    const phraseMatch = rule.phrases.some((phrase) => phraseHit(q, phrase));
    const termHits = rule.terms.filter((term) => tokens.includes(term)).length;
    if (
      phraseMatch ||
      termHits >= 2 ||
      (termHits >= 1 &&
        rule.id === "roadside_fuel" &&
        /road|highway|stranded|stuck|ended|empty|ran out/.test(q))
    ) {
      if (rule.helplineNumbers.includes(item.number))
        value += rule.boost + (phraseMatch ? 12 : Math.min(10, termHits * 3));
      else if (
        rule.id === "roadside_fuel" &&
        /bsnl|broadband|telecom|internet/.test(normalise(item.name + " " + item.keywords))
      )
        value = Math.max(0, value - 15);
    }
  }
  if (animalContext && item.number === "1962") value += 55;
  if (animalContext && /road accident assistance|traffic police/i.test(item.name))
    value = Math.max(0, value - 20);
  const fuelIntent =
    effectiveIntent === "roadside_fuel" ||
    INTENT_RULES[0].phrases.some((p) => phraseHit(q, p)) ||
    INTENT_RULES[0].terms.filter((t) => tokens.includes(t)).length >= 2;
  if (fuelIntent && ["1033", "1073"].includes(item.number)) value += 18;
  if (
    fuelIntent &&
    /bsnl|broadband|telecom|internet/.test(normalise(item.name + " " + item.keywords))
  )
    value = 0;
  if (
    item.urgent &&
    /\b(emergency|urgent|dying|unconscious|not breathing|life threatening|severe bleeding)\b/.test(
      q,
    )
  )
    value += 18;
  return value;
}
function Saath() {
  const { locale: interfaceLocale } = useI18n();
  const [query, setQuery] = useState("");
  const ranked = useMemo(() => {
    const prediction = trainedIntent(query);
    const phrase = multilingualPhraseIntent(query);
    return HELPLINES.map((item) => ({ item, score: score(item, query, prediction, phrase) })).sort(
      (a, b) => b.score - a.score,
    );
  }, [query]);
  const suggestions = query.trim() ? ranked.filter((x) => x.score > 0).slice(0, 5) : [];
  const visible = query.trim() ? ranked.filter((x) => x.score > 0).map((x) => x.item) : HELPLINES;
  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 pb-28 pt-7">
      <p role="note" className="mb-5 rounded-lg border border-warning p-4 text-sm">
        {interfaceLocale === "hi"
          ? "यह निर्देशिका भारत के लिए है। कुछ प्रविष्टियाँ अंग्रेज़ी में हैं और नंबरों की हालिया आधिकारिक पुष्टि बाकी है। सुझाया गया मिलान चिकित्सा या आपातकालीन निर्णय नहीं है। स्थानीय आपातकाल में अपनी आपातकालीन सेवा को कॉल करें।"
          : "This directory is for India. Some entries are English-only and current official verification of directory numbers is pending. A suggested match is not medical triage or an emergency decision. Use your local emergency service for immediate danger."}
      </p>

      <div className="border-b border-border pb-6 text-foreground sm:pb-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-lg bg-card/10">
            <HeartPulse className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-normal text-primary">
              AAPDA SETU · Help directory
            </p>
            <h1 className="font-display text-4xl font-extrabold">Saath</h1>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Indian emergency and support helplines.
        </p>
        <label htmlFor="saath-search" className="sr-only">
          Describe your situation
        </label>
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-card p-2 text-foreground shadow-sm">
          <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
          <input
            id="saath-search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Someone swallowed a cleaning liquid…"
            className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm outline-none"
          />
          <Button
            variant="ghost"
            type="button"
            onClick={() => setQuery("")}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Clear
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Directory entries are not independently verified. Nobody is contacted automatically.
        </p>
      </div>
      <div className="mt-5 rounded-lg border border-destructive bg-critical-soft p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-critical" />
          <div>
            <p className="font-bold text-critical">Immediate danger?</p>
            <p className="mt-1 text-sm text-critical">
              Call <b>112</b> for urgent police, fire or medical help in India. Do not wait for
              search results or rely on this directory if someone is in immediate danger.
            </p>
            <a
              href="tel:112"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-bold text-foreground"
            >
              <Phone className="size-4" /> Call 112
            </a>
          </div>
        </div>
      </div>
      <section className="mt-6" aria-label="AAPDA SETU assistant">
        <AssistantChat className="min-h-[28rem]" />
      </section>
      {suggestions.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Best matches for your situation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify the service and number before calling.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {suggestions.map(({ item }) => (
              <HelplineCard key={item.number + item.name} item={item} recommended />
            ))}
          </div>
        </section>
      )}
      {query.trim() && suggestions.length === 0 && (
        <div className="mt-6 rounded-lg border border-border bg-warning-soft p-4 text-sm text-warning">
          No suitable helpline match found in this directory. Try simpler words. For a vehicle
          breakdown on a national highway, try 1033; fuel delivery is not guaranteed. For immediate
          danger in India, call 112.
        </div>
      )}
      <section className="mt-7">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="mr-auto font-display text-2xl font-bold">
            {query.trim() ? "Matching helplines" : "Government helplines"}
          </h2>
          <span className="text-sm text-muted-foreground">{visible.length} listed</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <HelplineCard key={item.number + item.name} item={item} />
          ))}
        </div>
      </section>
      <p className="mt-6 rounded-lg bg-muted p-4 text-xs leading-5 text-muted-foreground">
        Source: the user-provided “Master Registry of Government of India Helplines” PDF. The
        directory has not been independently verified and some entries or descriptions may be
        outdated or inaccurate. Confirm numbers with official sources before relying on them.
        Toll-free availability and operating hours may vary. For life-threatening emergencies in
        India, prioritise 112 or local emergency services.
      </p>
    </main>
  );
}
function HelplineCard({ item, recommended = false }: { item: Helpline; recommended?: boolean }) {
  const Icon = item.urgent
    ? ShieldAlert
    : /mental|psychosocial|counselling/i.test(item.name)
      ? HeartPulse
      : /fire|gas/i.test(item.name)
        ? Flame
        : /railway|train/i.test(item.name)
          ? Train
          : /child|women/i.test(item.name)
            ? ShieldCheck
            : /animal/i.test(item.name)
              ? PawPrint
              : /electricity|power/i.test(item.name)
                ? Zap
                : /legal|human rights/i.test(item.name)
                  ? Scale
                  : /bank|fraud|RBI|SEBI/i.test(item.name)
                    ? Banknote
                    : /worker|scholarship|passport|voter/i.test(item.name)
                      ? GraduationCap
                      : Globe;
  return (
    <article
      className={`rounded-lg bg-card p-4 shadow-sm ring-1 ${recommended ? "ring-border" : "ring-border"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-lg ${item.urgent ? "bg-critical-soft text-critical" : "bg-muted text-muted-foreground"}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {recommended && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-normal text-primary">
                <Sparkles className="size-3" /> Suggested
              </span>
            )}
            {item.urgent && (
              <span className="rounded-full bg-critical-soft px-2 py-1 text-[10px] font-bold uppercase text-critical">
                Emergency
              </span>
            )}
          </div>
          <h3 className="mt-1 font-bold leading-snug text-foreground">{item.name}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.purpose}</p>
          <p className="mt-3 break-words font-mono text-lg font-extrabold text-foreground">
            {item.number}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <a
          href={`tel:${item.number.split("/")[0].replace(/[^+\d]/g, "")}`}
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-foreground"
        >
          <Phone className="size-4" /> Call number
        </a>
      </div>
    </article>
  );
}
