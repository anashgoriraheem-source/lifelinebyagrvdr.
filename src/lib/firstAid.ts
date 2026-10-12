/**
 * Offline first-aid guides, written for being read aloud: one short action
 * per step. Content follows widely published lay-rescuer guidance (Red
 * Cross / resuscitation council style). It is not a substitute for the
 * emergency operator, whose instructions always come first.
 */
export interface Guide {
  id: string
  title: string
  keywords: string[]
  /** 'always' = tell the user to call emergency services before anything else. */
  call: 'always' | 'if-severe'
  intro: string
  steps: string[]
  avoid?: string[]
  /** Show the CPR compression metronome (110 beats per minute). */
  metronome?: boolean
}

export const GUIDES: Guide[] = [
  {
    id: 'cpr',
    title: 'Not breathing · CPR',
    keywords: ['cpr', 'not breathing', 'unconscious', 'unresponsive', 'no pulse', 'cardiac arrest', 'collapsed', 'heart stopped', 'passed out not breathing'],
    call: 'always',
    intro: 'If the person is unresponsive and not breathing normally, start CPR now.',
    steps: [
      'Check the scene is safe. Tap their shoulders and shout. If no response, call the emergency number on speaker.',
      'Lay them flat on their back on a firm surface.',
      'Put the heel of one hand in the centre of the chest, the other hand on top. Lock your elbows.',
      'Push hard and fast: about 5 centimetres deep, 100 to 120 times a minute. Follow the beat.',
      'Let the chest come all the way back up between pushes.',
      'If you are trained, give 2 rescue breaths after every 30 pushes. If not, keep pushing without stopping.',
      'If someone brings an AED, switch it on and follow its voice prompts.',
      'Keep going until help takes over or the person starts breathing normally.',
    ],
    metronome: true,
  },
  {
    id: 'choking',
    title: 'Choking',
    keywords: ['choking', 'choke', "can't breathe food", 'something stuck', 'swallowed', 'stuck in throat'],
    call: 'if-severe',
    intro: 'If they can cough, encourage them to keep coughing. If they cannot speak, cough or breathe, act now.',
    steps: [
      'Stand to the side and slightly behind them. Support their chest with one hand and lean them forward.',
      'Give up to 5 firm back blows between the shoulder blades with the heel of your hand.',
      'If still choking, stand behind them, make a fist just above the belly button, grasp it with your other hand.',
      'Give up to 5 sharp inward and upward abdominal thrusts.',
      'Repeat 5 back blows and 5 thrusts. Call the emergency number if it has not cleared after three rounds.',
      'If they become unresponsive, lower them to the floor and start CPR.',
    ],
    avoid: ['Do not use abdominal thrusts on babies under one year or on pregnant women; use chest thrusts instead.'],
  },
  {
    id: 'chest-pain',
    title: 'Chest pain · possible heart attack',
    keywords: ['chest pain', 'heart attack', 'chest tight', 'pressure in chest', 'pain in left arm', 'jaw pain', 'angina'],
    call: 'always',
    intro: "Don't wait to see if it passes. Call the emergency number now.",
    steps: [
      'Call the emergency number now and say "possible heart attack".',
      'Sit down and rest in a comfortable position, ideally on the floor leaning against a wall with knees bent.',
      'Loosen tight clothing. Stay calm and keep still.',
      'Ask the emergency operator whether you should chew an aspirin. Do not take it if you are allergic to aspirin.',
      'If you have prescribed angina medicine, use it as your doctor told you.',
      'Unlock the door if you can, so responders can reach you.',
      'If you become unresponsive and stop breathing, anyone with you should start CPR.',
    ],
  },
  {
    id: 'stroke',
    title: 'Stroke signs · F.A.S.T.',
    keywords: ['stroke', 'face drooping', 'slurred speech', 'arm weakness', 'numb one side', 'confused speech', 'fast test', 'paralysis'],
    call: 'always',
    intro: "Every minute matters. Don't wait — call the emergency number now.",
    steps: [
      'Face: ask them to smile. Does one side droop?',
      'Arms: ask them to raise both arms. Does one drift down?',
      'Speech: ask them to repeat a simple sentence. Is it slurred or strange?',
      'Time: if you see any of these, call the emergency number immediately and say "stroke".',
      'Note the time the symptoms started. Doctors need this.',
      'Keep them comfortable and supported. If drowsy, place them on their side.',
    ],
    avoid: ['Do not give food, drink or medicine — swallowing may be affected.'],
  },
  {
    id: 'low-sugar',
    title: 'Low blood sugar',
    keywords: ['low sugar', 'sugar crash', 'hypo', 'hypoglycemia', 'hypoglycaemia', 'shaky', 'sweating diabetic', 'low glucose', 'sugar low', 'sugar is low', 'sugar dropped'],
    call: 'if-severe',
    intro: 'Act fast while the person can still swallow safely.',
    steps: [
      'Sit down right away so you do not fall.',
      'If conscious and able to swallow safely, take fast-acting sugar: a glass of juice or regular soft drink, glucose tablets, or a spoon of sugar or honey.',
      'Wait 15 minutes, then check sugar again if you can.',
      'If it is still low or you feel no better, take fast sugar again.',
      'Once you feel better, eat a snack with starch, like bread or biscuits.',
      'If the person is drowsy, confused, cannot swallow or is unconscious, call the emergency number. Place them on their side. Give nothing by mouth.',
    ],
  },
  {
    id: 'high-sugar',
    title: 'High blood sugar',
    keywords: ['high sugar', 'sugar spike', 'hyperglycemia', 'hyperglycaemia', 'high glucose', 'sugar high', 'sugar is high', 'very thirsty'],
    call: 'if-severe',
    intro: 'Very high sugar can become dangerous, especially with vomiting or drowsiness.',
    steps: [
      'Sip water slowly if you can swallow safely.',
      'Re-check your blood sugar to confirm the reading.',
      'Follow the sick-day plan your doctor gave you. Do not change medicine doses on your own.',
      'Call the emergency number if you are vomiting, breathing fast, very drowsy, confused, or have fruity-smelling breath.',
      'Contact your doctor today even if you feel okay.',
    ],
  },
  {
    id: 'high-bp',
    title: 'Very high blood pressure',
    keywords: ['high bp', 'high blood pressure', 'bp spike', 'hypertension', 'pressure very high', 'severe headache'],
    call: 'if-severe',
    intro: 'Sit quietly and re-check. Some symptoms need emergency care immediately.',
    steps: [
      'Sit down, back supported, feet flat. Rest for 5 minutes.',
      'Re-measure your blood pressure with the cuff on a bare upper arm at heart level.',
      'Call the emergency number now if you also have chest pain, shortness of breath, a severe headache, confusion, vision changes, weakness or trouble speaking.',
      'If the reading stays very high without symptoms, contact your doctor today.',
      'Do not take extra blood pressure medicine unless your doctor told you to.',
    ],
  },
  {
    id: 'heart-racing',
    title: 'Heart racing',
    keywords: ['heart racing', 'palpitations', 'fast heartbeat', 'heart pounding', 'tachycardia', 'pulse high'],
    call: 'if-severe',
    intro: 'Stop what you are doing and sit down.',
    steps: [
      'Sit or lie down. Stop any activity.',
      'Breathe slowly: in for 4 seconds, out for 6 seconds.',
      'Call the emergency number if you also have chest pain, fainting, severe breathlessness or confusion.',
      'If it does not settle within a few minutes, seek medical help.',
    ],
  },
  {
    id: 'breathing',
    title: 'Breathing difficulty · low oxygen',
    keywords: ['breathing', 'breathless', 'short of breath', "can't breathe", 'asthma', 'wheezing', 'low oxygen', 'spo2'],
    call: 'if-severe',
    intro: 'Help the person sit upright and breathe slowly.',
    steps: [
      'Sit upright, leaning slightly forward. Loosen tight clothing.',
      'If you have a prescribed reliever inhaler, use it as your doctor told you.',
      'Breathe slowly through the nose and out through pursed lips.',
      'Check the oximeter is on a warm finger and you are keeping still; cold hands and movement give false low readings.',
      'Call the emergency number if lips or face turn blue or grey, speaking is hard, or it is not improving.',
    ],
  },
  {
    id: 'bleeding',
    title: 'Severe bleeding',
    keywords: ['bleeding', 'blood loss', 'cut', 'wound', 'deep cut', 'haemorrhage', 'hemorrhage'],
    call: 'if-severe',
    intro: 'Press hard on the wound and keep pressing.',
    steps: [
      'Wear gloves if you have them. Press firmly on the wound with a clean cloth or dressing.',
      'Keep steady pressure for at least 10 minutes. Do not keep lifting to check.',
      'If blood soaks through, add more cloth on top. Do not remove the first layer.',
      'Raise the injured part above heart level if it does not cause pain.',
      'Call the emergency number for heavy bleeding that will not stop, spurting blood, or if they feel faint.',
    ],
    avoid: ['Do not remove an object stuck in the wound — press around it.'],
  },
  {
    id: 'burns',
    title: 'Burns',
    keywords: ['burn', 'burned', 'burnt', 'scald', 'fire', 'hot water'],
    call: 'if-severe',
    intro: 'Cool the burn with running water straight away.',
    steps: [
      'Move away from the heat source.',
      'Cool the burn under cool running water for 20 minutes.',
      'Remove rings, watches or clothing near the burn unless stuck to the skin.',
      'Cover loosely with cling film or a clean, non-fluffy cloth.',
      'Call the emergency number for large burns, burns on the face, hands or genitals, or electrical and chemical burns.',
    ],
    avoid: ['Do not use ice, butter, toothpaste or creams.', 'Do not burst blisters.'],
  },
  {
    id: 'fall',
    title: 'After a fall · head injury',
    keywords: ['fall', 'fell', 'fallen', 'tripped', 'head injury', 'hit my head', 'bump on head', 'concussion'],
    call: 'if-severe',
    intro: "Don't get up quickly. Check yourself first.",
    steps: [
      'Stay still for a moment. Breathe and check for pain.',
      'If you are badly hurt, or have neck or back pain, do not move — call for help.',
      'If you can, roll onto your side, get onto hands and knees, and crawl to a sturdy chair.',
      'Use the chair to push yourself up slowly, then sit down.',
      'Call the emergency number for confusion, vomiting, seizure, severe headache, bleeding that will not stop, or if you take blood thinners and hit your head.',
    ],
  },
  {
    id: 'fainting',
    title: 'Fainting · dizziness',
    keywords: ['faint', 'fainted', 'fainting', 'dizzy', 'lightheaded', 'low bp', 'blood pressure low', 'bp crash', 'collapse'],
    call: 'if-severe',
    intro: 'Lie down before you fall.',
    steps: [
      'Lie down on your back right away.',
      'Raise your legs about 30 centimetres on a pillow or chair.',
      'Loosen tight clothing and get fresh air.',
      'Stay lying down for 10 to 15 minutes, then sit up slowly.',
      'If they do not wake within a minute, check breathing. If not breathing normally, call the emergency number and start CPR.',
    ],
  },
  {
    id: 'seizure',
    title: 'Seizure',
    keywords: ['seizure', 'having a fit', 'convulsion', 'epilepsy', 'shaking uncontrollably'],
    call: 'if-severe',
    intro: 'Keep them safe. Do not hold them down.',
    steps: [
      'Note the time the seizure started.',
      'Move hard or sharp objects away. Cushion their head.',
      'Do not hold them down and do not put anything in their mouth.',
      'When the shaking stops, roll them onto their side and check breathing.',
      'Call the emergency number if it lasts more than 5 minutes, it is their first seizure, they are injured, or they do not wake up.',
    ],
  },
  {
    id: 'allergy',
    title: 'Severe allergic reaction',
    keywords: ['allergy', 'allergic', 'anaphylaxis', 'swelling', 'swollen throat', 'hives', 'bee sting', 'epipen'],
    call: 'always',
    intro: 'Swelling of the face or throat, or trouble breathing, is an emergency.',
    steps: [
      'Call the emergency number and say "anaphylaxis".',
      'If they have an adrenaline auto-injector, help them use it in the outer thigh.',
      'If breathing is hard, let them sit up. If they feel faint, lay them down with legs raised.',
      'If there is no improvement after 5 minutes and they have a second auto-injector, use it.',
      'If they stop breathing, start CPR.',
    ],
  },
  {
    id: 'heat',
    title: 'Heat stroke',
    keywords: ['heat stroke', 'heatstroke', 'sunstroke', 'overheated', 'too hot', 'heat exhaustion'],
    call: 'if-severe',
    intro: 'Cool them down as fast as possible.',
    steps: [
      'Move them to a cool, shaded place.',
      'Remove extra clothing.',
      'Cool the skin with cool water and fan them. Place cold packs in the armpits and neck.',
      'If they are alert, give small sips of cool water.',
      'Call the emergency number if they are confused, stop sweating, faint or have a seizure.',
    ],
  },
  {
    id: 'poisoning',
    title: 'Poisoning · overdose',
    keywords: ['poison', 'poisoning', 'overdose', 'swallowed chemical', 'took too many pills'],
    call: 'always',
    intro: 'Call the emergency number. Keep the container to show responders.',
    steps: [
      'Call the emergency number and tell them what was taken, how much and when.',
      'Do not make them vomit unless told to.',
      'If they are drowsy but breathing, place them on their side.',
      'If they stop breathing, start CPR.',
    ],
  },
  {
    id: 'shock',
    title: 'Electric shock',
    keywords: ['electric shock', 'electrocuted', 'electrocution', 'electric current'],
    call: 'always',
    intro: 'Do not touch them until the power is off.',
    steps: [
      'Switch off the power at the mains or unplug the device.',
      'If you cannot, stand on dry material and push the source away with something wooden or plastic.',
      'Call the emergency number.',
      'If they are not breathing normally, start CPR.',
      'Cool any burns with running water.',
    ],
  },
]

export const guideById = (id: string) => GUIDES.find((g) => g.id === id)

/** Score guides against free text. Returns the best match if any keyword hits. */
export function matchGuide(text: string): Guide | null {
  const q = ` ${text.toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ')} `
  let best: { g: Guide; score: number } | null = null
  for (const g of GUIDES) {
    let score = 0
    // Keywords must start at a word boundary ("burn" matches "burns", not "heartburn").
    for (const k of g.keywords) if (q.includes(` ${k}`)) score += k.split(' ').length + 1
    if (score > 0 && (!best || score > best.score)) best = { g, score }
  }
  return best?.g ?? null
}
