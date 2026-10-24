import { z } from 'zod'

import { MAX_FEEDBACK_CHARS } from '@/modules/ai/domain/coaching-contract.ts'

// Moved verbatim from plan.routes.js (Pass 8: centralize schemas).
//
// `note` is one of the few athlete-written strings that reaches the AI prompt
// (coaching-prompt.ts interpolates it as `felt="…"`). It is capped here at the
// same length the prompt enforces, so a note is never accepted in full and then
// silently sliced on the way to the model.
export const feedbackSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }).refine(v => {
    const [y, m, d] = v.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }, { message: 'date must be a real calendar date' }),
  rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
  status: z.enum(['completed', 'skipped', 'modified']).optional().default('completed'),
  note: z.string().max(MAX_FEEDBACK_CHARS).optional(),
  notes: z.string().max(MAX_FEEDBACK_CHARS).optional(),
})
