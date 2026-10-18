import { describe, expect, it } from 'vitest'
import { normaliseAssistantRequest } from './assistantLanguages'
describe('Uploaded multilingual emergency intents',()=>{
  it('recognizes Hindi ambulance requests',()=>expect(normaliseAssistantRequest('ambulance chahiye','hi')).toBe('ambulance'))
  it('recognizes Urdu breathing emergencies',()=>expect(normaliseAssistantRequest('سانس نہیں آ رہی','ur')).toBe('ambulance'))
  it('recognizes Punjabi fire emergencies',()=>expect(normaliseAssistantRequest('agg lag gayi','pa')).toBe('emergency fire'))
  it('preserves unknown text',()=>expect(normaliseAssistantRequest('ਅਣਜਾਣ','pa')).toBe('ਅਣਜਾਣ'))
})
