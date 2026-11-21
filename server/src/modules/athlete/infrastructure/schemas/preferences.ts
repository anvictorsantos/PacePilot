import { z } from 'zod'

/** PATCH-shaped: every field optional, at least one required by the caller. */
export const coachingPreferencesSchema = z.object({
  explanations: z.boolean().optional(),
  sessionReminder: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  locale: z.enum(['en', 'pt']).optional(),
})

const isPublicHttps = (value: string): boolean => {
  if (!value.startsWith('https://')) return false
  try {
    const host = new URL(value).hostname
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && !/^10\.|^192\.168\./.test(host)
  } catch {
    return false
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(isPublicHttps, 'Push endpoint must be a public HTTPS URL'),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
})
