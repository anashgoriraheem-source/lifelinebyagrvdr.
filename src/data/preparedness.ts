export interface PreparednessTopic {
  id: string;
  title: string;
  summary: string;
  checklist: string[];
}

/** Practical planning prompts; not operational fire or disaster instructions. */
export const PREPAREDNESS_TOPICS: PreparednessTopic[] = [
  {
    id: "home",
    title: "Home preparedness",
    summary: "Make essential information and supplies easy to find before a disruption.",
    checklist: [
      "Keep emergency numbers and important contacts somewhere everyone can find.",
      "Choose two exits from commonly used rooms and keep paths clear.",
      "Store a torch, basic first-aid supplies, water and essential medicines accessibly.",
      "Know how to safely switch off utilities, and ask the utility provider for instructions.",
    ],
  },
  {
    id: "family-plan",
    title: "Family emergency plan",
    summary: "Agree how household members will reconnect if separated.",
    checklist: [
      "Choose an out-of-area contact who can pass messages between family members.",
      "Agree on a nearby meeting place and a second place outside your neighbourhood.",
      "Plan support for children, older adults, disabled people and pets.",
      "Practise the plan and update contact details when they change.",
    ],
  },
  {
    id: "first-aid-kit",
    title: "First-aid kit",
    summary: "Build a kit around your household’s needs and check it regularly.",
    checklist: [
      "Include clean dressings, bandages, adhesive tape, gloves and small scissors.",
      "Add a first-aid guide, a torch and any personal emergency information you rely on.",
      "Keep medicines in their original labelled packaging and follow their storage instructions.",
      "Check expiry dates and replace used or damaged items.",
    ],
  },
  {
    id: "road-safety",
    title: "Road safety",
    summary: "Prepare for safer travel and know what information to share after a collision.",
    checklist: [
      "Wear a seat belt and use age-appropriate child restraints on every journey.",
      "Keep a charged phone, emergency contacts and basic supplies in the vehicle.",
      "If a collision occurs, move to a safer place only if it is safe to do so and contact local emergency services.",
      "Do not move an injured person unless there is immediate danger; follow the operator’s instructions.",
    ],
  },
  {
    id: "fire-safety",
    title: "Fire safety",
    summary: "Plan escape routes and follow local fire-service guidance for your building.",
    checklist: [
      "Identify exits and keep doors, corridors and stairways clear.",
      "Agree a meeting place outside and make sure everyone knows how to raise an alarm.",
      "Check smoke alarms as directed by the manufacturer or local fire service.",
      "If there is a fire, leave by a safe route and call the local emergency number from outside.",
    ],
  },
  {
    id: "flood",
    title: "Flood preparedness",
    summary: "Use official local alerts and plan how to protect people, pets and key documents.",
    checklist: [
      "Find your local official flood-warning source and keep alerts enabled.",
      "Prepare a small go-bag with essential medicines, documents and a phone charger.",
      "Plan transport and a safe destination with household members who may need assistance.",
      "Never walk or drive through floodwater; follow official evacuation instructions.",
    ],
  },
  {
    id: "disaster",
    title: "Disaster awareness",
    summary: "Prepare for hazards identified by your local authorities and trusted responders.",
    checklist: [
      "Learn which hazards are common in your area from official public-safety sources.",
      "Keep water, shelf-stable food, essential supplies and a torch for likely disruptions.",
      "Know where local authorities publish evacuation and shelter information.",
      "Check on neighbours who may need help, when it is safe to do so.",
    ],
  },
  {
    id: "communication",
    title: "Emergency communication",
    summary: "Make it easier to reach help and share concise, useful information.",
    checklist: [
      "Save local emergency numbers and key contacts in more than one place.",
      "Choose a family check-in contact and agree on a short message plan.",
      "Keep a power bank charged and learn how your phone shares its location.",
      "When calling for help, give your location, what happened, hazards and callback number.",
    ],
  },
];
