// Bounded AI proposals. The model may only move a day inside the envelope the
// programme already granted: it can lighten, never add a session, a hard day or a
// longer long run. Anything else is rejected here, before the engine rebuilds.
import type { ProgrammeWeek, SessionRole } from '@/modules/training/domain/programme.ts'

export const AI_DAY_ROLES = ['easy', 'recovery', 'quality', 'long', 'rest'] as const

export interface AiWeekShape {
  /** Mon–Sun, seven entries. */
  days: SessionRole[]
}

export interface ShapedProgramme {
  programme: ProgrammeWeek
  /** Only the days the proposal actually moved, for the UI badge. */
  adjusted: Array<{ dayIndex: number; from: SessionRole; to: SessionRole }>
}

const VALID = new Set<string>(AI_DAY_ROLES)

/** Returns null when the proposal is malformed or asks for nothing the engine allows. */
export function applyAiShape(
  programme: ProgrammeWeek,
  shape: AiWeekShape | null | undefined,
): ShapedProgramme | null {
  const days = shape?.days
  if (!Array.isArray(days) || days.length !== 7) return null
  if (days.some(role => !VALID.has(role))) return null

  const roles = [...programme.roles] as SessionRole[]
  const adjusted: ShapedProgramme['adjusted'] = []

  for (let i = 0; i < 7; i++) {
    const from = programme.roles[i]
    const to = days[i]
    if (to === from) continue
    // A rest day is the engine's decision that there is no session to lighten.
    if (from === 'rest') continue
    // The model may never add a hard day or move the long run to another day.
    if (to === 'quality' || to === 'long') continue
    roles[i] = to
    adjusted.push({ dayIndex: i, from, to })
  }
  if (!adjusted.length) return null

  return { programme: { ...programme, roles }, adjusted }
}
