import { z } from 'zod'

// Moved verbatim from plan.routes.js (Pass 8: centralize schemas).
export const feedbackSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }).refine(v => {
    const [y, m, d] = v.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }, { message: 'date must be a real calendar date' }),
  rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
  status: z.enum(['completed', 'skipped', 'modified']).optional().default('completed'),
  note: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
})
