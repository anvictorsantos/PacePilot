import { z } from 'zod'

// Whitelist shape — unknown keys stripped, never persisted.
// Moved verbatim from goals.routes.js (Pass 8: centralize schemas).
export const goalSchema = z.object({
  goal_type: z.enum(['general_fitness', '5K', '10K', 'half_marathon', 'marathon', 'distance_completion', 'maintain']).optional(),
  target_time_min: z.number().positive().max(24 * 60).optional(),
  goal_date: z.string().max(30).refine(v => !Number.isNaN(Date.parse(v)), { message: 'goal_date must be a valid date' }).optional(),
  days_per_week: z.number().int().min(1).max(7).optional(),
  preferred_days: z.array(z.string().max(12)).max(7).optional(),
  constraints: z.array(z.string().max(120)).max(20).optional(),
})
