import { z } from 'zod'

import {
  AI_LOCALES,
  DEFAULT_AI_LOCALE,
  type AiLocale,
} from '@/modules/ai/domain/coaching-contract.ts'

// `.catch` rather than `.default`: an unknown or repeated `?locale=` degrades to
// the app default rather than failing a request the plan does not depend on.
export const aiLocaleQuery = z.enum(AI_LOCALES).catch(DEFAULT_AI_LOCALE)

export function parseAiLocale(raw: unknown): AiLocale {
  return aiLocaleQuery.parse(raw)
}
