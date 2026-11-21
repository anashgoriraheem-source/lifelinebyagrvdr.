export type MedicalTermCategory =
  "Emergency" | "Body systems" | "Injuries and symptoms" | "Tests and care";

export interface MedicalTerm {
  id: string;
  term: string;
  category: MedicalTermCategory;
  definition: string;
  example: string;
  related: string[];
}

/** Plain-language study notes; this glossary is not clinical advice or a diagnosis. */
export const MEDICAL_TERMS: MedicalTerm[] = [
  {
    id: "first-aid",
    term: "First aid",
    category: "Emergency",
    definition:
      "Immediate basic care given for an injury or sudden illness while professional help is being arranged.",
    example:
      "A bystander calls for help and follows a first-aid course while waiting for responders.",
    related: ["Emergency medical services", "CPR", "AED"],
  },
  {
    id: "emergency-medical-services",
    term: "Emergency medical services (EMS)",
    category: "Emergency",
    definition:
      "The organised services that respond to urgent medical emergencies and provide care during transport.",
    example:
      "A caller gives the dispatcher the location and follows the instructions while EMS is on the way.",
    related: ["First aid", "Triage"],
  },
  {
    id: "cpr",
    term: "Cardiopulmonary resuscitation (CPR)",
    category: "Emergency",
    definition:
      "An emergency procedure that uses chest compressions, and sometimes rescue breaths, when a person is in cardiac arrest.",
    example:
      "A trained responder follows the emergency dispatcher’s instructions while another person finds an AED.",
    related: ["AED", "Cardiac arrest", "Emergency medical services"],
  },
  {
    id: "aed",
    term: "Automated external defibrillator (AED)",
    category: "Emergency",
    definition:
      "A portable device that checks a heart rhythm and gives spoken or visual prompts about whether a shock is advised.",
    example:
      "A bystander turns on a public AED and follows its prompts without delaying emergency services.",
    related: ["CPR", "Cardiac arrest"],
  },
  {
    id: "choking",
    term: "Choking",
    category: "Emergency",
    definition: "A blockage in the airway that makes breathing difficult or impossible.",
    example: "A person suddenly cannot speak or breathe normally while eating.",
    related: ["Airway", "Breathing", "Emergency medical services"],
  },
  {
    id: "anaphylaxis",
    term: "Anaphylaxis",
    category: "Emergency",
    definition:
      "A severe, fast-moving allergic reaction that can affect breathing or circulation and needs urgent medical care.",
    example:
      "Sudden throat swelling after an exposure may be a sign of a severe allergic emergency.",
    related: ["Allergy", "Airway", "Emergency medical services"],
  },
  {
    id: "seizure",
    term: "Seizure",
    category: "Emergency",
    definition:
      "A sudden episode of abnormal electrical activity in the brain that can change movement, awareness, sensation, or behaviour.",
    example: "Some seizures cause shaking; others may mainly affect awareness or responsiveness.",
    related: ["Consciousness", "Neurology"],
  },
  {
    id: "stroke",
    term: "Stroke",
    category: "Emergency",
    definition:
      "A medical emergency in which blood flow to part of the brain is interrupted or bleeding occurs in the brain.",
    example:
      "Sudden face, arm, speech, balance, or vision changes can be warning signs that need urgent assessment.",
    related: ["Brain", "Emergency medical services", "Triage"],
  },
  {
    id: "cardiac-arrest",
    term: "Cardiac arrest",
    category: "Emergency",
    definition:
      "A sudden loss of the heart’s effective pumping action; the person becomes unresponsive and is not breathing normally.",
    example:
      "A person collapses and does not respond. Call emergency services and follow dispatcher instructions.",
    related: ["CPR", "AED", "Heart"],
  },
  {
    id: "airway",
    term: "Airway",
    category: "Body systems",
    definition:
      "The passage that carries air through the nose or mouth and throat toward the lungs.",
    example: "A blocked airway can prevent enough air from reaching the lungs.",
    related: ["Breathing", "Choking", "Lungs"],
  },
  {
    id: "artery",
    term: "Artery",
    category: "Body systems",
    definition: "A blood vessel that carries blood away from the heart.",
    example: "Arteries are part of the body’s circulation system.",
    related: ["Vein", "Circulation", "Heart"],
  },
  {
    id: "vein",
    term: "Vein",
    category: "Body systems",
    definition: "A blood vessel that carries blood toward the heart.",
    example: "Veins return blood from the body to the heart.",
    related: ["Artery", "Circulation", "Heart"],
  },
  {
    id: "circulation",
    term: "Circulation",
    category: "Body systems",
    definition: "The movement of blood through the heart and blood vessels around the body.",
    example: "The heart pumps blood through arteries and receives it back through veins.",
    related: ["Artery", "Vein", "Heart"],
  },
  {
    id: "heart-rate",
    term: "Heart rate",
    category: "Body systems",
    definition:
      "The number of times the heart beats in a period of time, usually counted per minute.",
    example:
      "A clinician may measure heart rate during an examination; it can change with activity and other factors.",
    related: ["Pulse", "Cardiovascular system"],
  },
  {
    id: "blood-pressure",
    term: "Blood pressure",
    category: "Body systems",
    definition:
      "The force of blood pushing against the walls of the arteries; it is recorded as systolic and diastolic numbers.",
    example: "A record such as 120/80 has a systolic number followed by a diastolic number.",
    related: ["Systolic", "Diastolic", "Artery"],
  },
  {
    id: "respiratory-rate",
    term: "Respiratory rate",
    category: "Body systems",
    definition:
      "The number of breaths a person takes in a period of time, usually counted per minute.",
    example: "A clinician may count breaths while observing breathing at rest.",
    related: ["Breathing", "Lungs", "Airway"],
  },
  {
    id: "oxygen-saturation",
    term: "Oxygen saturation",
    category: "Body systems",
    definition:
      "An estimate of how much oxygen the blood is carrying, often written as a percentage.",
    example:
      "A clinician may use a fingertip sensor as one part of an assessment; the number alone does not explain how a person feels.",
    related: ["Oxygen", "Lungs", "Respiratory system"],
  },
  {
    id: "consciousness",
    term: "Consciousness",
    category: "Body systems",
    definition: "A person’s state of awareness of themselves and their surroundings.",
    example: "A responder may check whether a person responds to voice and touch.",
    related: ["Unconsciousness", "Brain", "Seizure"],
  },
  {
    id: "fracture",
    term: "Fracture",
    category: "Injuries and symptoms",
    definition: "A break or crack in a bone.",
    example: "An X-ray may be used by a clinician to assess a suspected fracture.",
    related: ["Bone", "Sprain", "X-ray"],
  },
  {
    id: "sprain",
    term: "Sprain",
    category: "Injuries and symptoms",
    definition: "An injury to a ligament, the tissue that connects bones at a joint.",
    example: "A twisted ankle can injure ligaments around the joint.",
    related: ["Ligament", "Fracture", "Strain"],
  },
  {
    id: "burn",
    term: "Burn",
    category: "Injuries and symptoms",
    definition:
      "An injury to skin or other tissue caused by heat, chemicals, electricity, sunlight, or radiation.",
    example: "A hot liquid can cause a scald, which is a type of burn.",
    related: ["Skin", "First aid", "Emergency medical services"],
  },
  {
    id: "wound",
    term: "Wound",
    category: "Injuries and symptoms",
    definition: "An injury that breaks or damages the skin or other body tissue.",
    example: "A cut is an open wound; a bruise is a closed injury under the skin.",
    related: ["Bleeding", "First aid", "Skin"],
  },
  {
    id: "dehydration",
    term: "Dehydration",
    category: "Injuries and symptoms",
    definition: "A condition that occurs when the body loses more fluid than it takes in.",
    example: "Illness, heat, or not drinking enough can contribute to fluid loss.",
    related: ["Heat illness", "Electrolyte", "Symptom"],
  },
  {
    id: "fever",
    term: "Fever",
    category: "Injuries and symptoms",
    definition:
      "A temporary rise in body temperature that can happen as part of the body’s response to illness.",
    example: "A thermometer reading is interpreted with a person’s age, symptoms, and situation.",
    related: ["Temperature", "Symptom", "Infection"],
  },
  {
    id: "fainting",
    term: "Fainting (syncope)",
    category: "Injuries and symptoms",
    definition:
      "A brief loss of consciousness that happens when the brain temporarily receives too little blood flow.",
    example:
      "A person may briefly lose consciousness and then wake up; the cause still may need medical assessment.",
    related: ["Consciousness", "Dizziness", "Emergency medical services"],
  },
  {
    id: "symptom",
    term: "Symptom",
    category: "Injuries and symptoms",
    definition: "A change in health that a person experiences and reports, such as pain or nausea.",
    example:
      "A person can describe a headache as a symptom; it does not identify the cause by itself.",
    related: ["Sign", "Diagnosis", "Triage"],
  },
  {
    id: "diagnosis",
    term: "Diagnosis",
    category: "Tests and care",
    definition:
      "A clinician’s identification of a health condition based on the available history, examination, and tests.",
    example:
      "A symptom alone is not a diagnosis; a qualified clinician assesses the full situation.",
    related: ["Symptom", "Test", "Triage"],
  },
  {
    id: "triage",
    term: "Triage",
    category: "Tests and care",
    definition: "The process of sorting people by how urgently they need assessment or treatment.",
    example: "In an emergency department, staff may assess the most urgent cases first.",
    related: ["Emergency medical services", "Diagnosis"],
  },
  {
    id: "ecg",
    term: "Electrocardiogram (ECG/EKG)",
    category: "Tests and care",
    definition: "A test that records the electrical activity of the heart over a short period.",
    example:
      "A clinician may use an ECG as part of an evaluation of chest discomfort or an abnormal rhythm.",
    related: ["Heart", "Heart rhythm", "Test"],
  },
  {
    id: "x-ray",
    term: "X-ray",
    category: "Tests and care",
    definition:
      "An imaging test that uses a small amount of radiation to create pictures of structures inside the body.",
    example: "A clinician may request an X-ray to assess a suspected bone injury.",
    related: ["Fracture", "Imaging", "Test"],
  },
  {
    id: "mri",
    term: "Magnetic resonance imaging (MRI)",
    category: "Tests and care",
    definition:
      "An imaging test that uses a strong magnet and radio waves to create detailed pictures inside the body.",
    example:
      "A clinician chooses whether an MRI is suitable for a particular question and patient.",
    related: ["Imaging", "Test", "Radiology"],
  },
];

export const MEDICAL_TERM_SOURCES = [
  {
    name: "MedlinePlus: Understanding Medical Words",
    url: "https://medlineplus.gov/medwords/",
  },
  {
    name: "MedlinePlus: Definitions of Health Terms",
    url: "https://medlineplus.gov/definitions/generalhealthdefinitions.html",
  },
  {
    name: "MedlinePlus: First Aid",
    url: "https://medlineplus.gov/firstaid.html",
  },
] as const;
