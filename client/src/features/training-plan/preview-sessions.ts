// Pure so the ranking is testable without @vue/test-utils. The long run leads, quality
// work follows in date order, easy days fill the rest; rest days are never cards.
import { isQualityWorkout } from '@/modules/shared/ui/training-vocabulary.ts'
import type { PlanDay } from '@/modules/training/infrastructure/dto/PlanDay.ts'

export const PREVIEW_SESSION_LIMIT = 3

export interface PreviewSession {
  date: string
  type: string
  distanceKm: number | null
}

function rank(type: string): number {
  if (type === 'long') return 0
  if (isQualityWorkout(type)) return 1
  return 2
}

export function previewSessions(
  week: PlanDay[] | null | undefined,
  limit: number = PREVIEW_SESSION_LIMIT,
): PreviewSession[] {
  return (week ?? [])
    .flatMap((day) => {
      const type = day.workout?.type
      if (!type || type === 'rest') return []
      return [
        {
          date: day.date ?? '',
          type,
          distanceKm: day.workout?.distance_km ?? null,
        },
      ]
    })
    .sort((a, b) => rank(a.type) - rank(b.type) || a.date.localeCompare(b.date))
    .slice(0, Math.max(0, limit))
}
