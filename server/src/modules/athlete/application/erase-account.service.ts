// Account erasure spans every collection keyed by the athlete: the row itself,
// training data, provider credentials and the resumable import cursor.
import mongoose from 'mongoose'

import { Athlete } from '@/modules/athlete/infrastructure/persistence/Athlete.ts'
import { Activity } from '@/modules/activities/infrastructure/persistence/Activity.ts'
import { WorkoutFeedback } from '@/modules/training/infrastructure/persistence/WorkoutFeedback.ts'
import { Connection } from '@/modules/providers/infrastructure/persistence/Connection.ts'
import { BackfillCursor } from '@/modules/providers/infrastructure/persistence/BackfillCursor.ts'
import { clearAiCacheForAthlete } from '@/modules/ai/application/quota-cache.ts'

/** Deletes the rows a filter selects and reports the count, inside an optional transaction. */
export type EraseRows = (athleteId: unknown, session?: mongoose.ClientSession) => Promise<number>

export interface EraseAccountDeps {
  activities: EraseRows
  feedbacks: EraseRows
  connections: EraseRows
  cursors: EraseRows
  athlete: EraseRows
  clearCache(athleteId: string): void
}

// The slice of a model this module needs; structural so tests pass plain functions.
interface DeletableModel {
  deleteMany(
    filter: object,
    options?: { session?: mongoose.ClientSession },
  ): Promise<{ deletedCount?: number }>
}

function eraseBy(
  model: DeletableModel,
  filter: (id: unknown) => object,
): EraseRows {
  return async (id, session) =>
    (await model.deleteMany(filter(id), { session })).deletedCount ?? 0
}

const defaultDeps: EraseAccountDeps = {
  activities: eraseBy(Activity as unknown as DeletableModel, (id) => ({ athlete: id })),
  feedbacks: eraseBy(WorkoutFeedback as unknown as DeletableModel, (id) => ({ athlete: id })),
  connections: eraseBy(Connection as unknown as DeletableModel, (id) => ({ athlete: id })),
  cursors: eraseBy(BackfillCursor as unknown as DeletableModel, (id) => ({ athlete: id })),
  athlete: eraseBy(Athlete as unknown as DeletableModel, (id) => ({ _id: id })),
  clearCache: clearAiCacheForAthlete,
}

/** Every collection keyed by the athlete, then the athlete row; returns the row count. */
export async function eraseAccount(
  athleteId: unknown,
  session?: mongoose.ClientSession,
  deps: EraseAccountDeps = defaultDeps,
): Promise<number> {
  const [activities, feedbacks, connections, cursors] = await Promise.all([
    deps.activities(athleteId, session),
    deps.feedbacks(athleteId, session),
    deps.connections(athleteId, session),
    deps.cursors(athleteId, session),
  ])
  const removed = await deps.athlete(athleteId, session)
  deps.clearCache(String(athleteId))
  return activities + feedbacks + connections + cursors + removed
}
