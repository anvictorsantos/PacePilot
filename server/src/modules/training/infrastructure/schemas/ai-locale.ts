import { z } from 'zod'

import {
  AI_LOCALES,
  DEFAULT_AI_LOCALE,
  type AiLocale,
} from '@/modules/ai/domain/coaching-contract.ts'

/**
 * `?locale=` on the AI routes. `.catch` rather than `.default`: an unknown or
 * repeated value degrades to the app default instead of failing the request —
 * a bad locale must never cost the athlete their plan, and the plan itself is
 * language-neutral.
 */
export const aiLocaleQuery = z.enum(AI_LOCALES).catch(DEFAULT_AI_LOCALE)

export function parseAiLocale(raw: unknown): AiLocale {
  return aiLocaleQuery.parse(raw)
}
