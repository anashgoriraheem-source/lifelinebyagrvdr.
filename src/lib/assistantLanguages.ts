import phrases from '@/data/saath-multilingual-phrases.json'
export const ASSISTANT_LANGUAGES = [
  {code:'en',name:'English',voice:'en-IN',direction:'ltr'},
  {code:'hi',name:'हिन्दी',voice:'hi-IN',direction:'ltr'},
  {code:'pa',name:'ਪੰਜਾਬੀ',voice:'pa-IN',direction:'ltr'},
  {code:'ur',name:'اردو',voice:'ur-PK',direction:'rtl'},
] as const
export type AssistantLanguage = typeof ASSISTANT_LANGUAGES[number]['code']
const packs = phrases as Record<string, Record<string,string[]>>
const requests: Record<string,string> = {medical_emergency:'ambulance',fire_gas:'emergency fire',road_crash:'emergency road accident',poisoning:'poisoning',mental_health:'panic attack',women_safety:'police',child_safety:'police'}
export function normaliseAssistantRequest(input: string, language: AssistantLanguage) {
  if (language==='en') return input
  const query=input.toLowerCase().normalize('NFC').trim()
  let matched='',length=0
  for (const [intent,examples] of Object.entries(packs[language]??{})) for (const example of examples) {
    const phrase=example.toLowerCase().normalize('NFC')
    if(requests[intent]&&query.includes(phrase)&&phrase.length>length){matched=requests[intent];length=phrase.length}
  }
  return matched||input
}
