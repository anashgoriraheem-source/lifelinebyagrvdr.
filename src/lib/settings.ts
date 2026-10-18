import { z } from 'zod'
const threshold = z.object({ below: z.number().finite().nullable(), above: z.number().finite().nullable(), above2: z.number().finite().nullable().optional() })
export const persistedSettingsSchema = z.object({
  demoMode: z.boolean().optional(),
  contacts: z.array(z.object({id:z.string(),name:z.string(),relationship:z.string(),phone:z.string(),call:z.boolean(),sms:z.boolean()})).optional(),
  countryCode: z.enum(['IN','US','GB','EU','AU']).optional(),
  countdownSeconds: z.number().int().min(0).max(60).optional(),
  thresholds: z.object({bp:threshold,hr:threshold,spo2:threshold,glucose:threshold}).optional(),
  profile: z.object({name:z.string(),age:z.number().nonnegative().nullable(),bloodType:z.string(),conditions:z.array(z.string()),allergies:z.array(z.string()),medications:z.array(z.string())}).optional(),
})
