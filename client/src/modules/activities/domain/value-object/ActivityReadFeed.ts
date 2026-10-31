import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

// Declared here, not imported from the HTTP DTO: the rule is domain vocabulary.
export interface ImportStampedActivity {
  date?: string | null
  start_date?: string | null
  createdAt?: string | null
}

interface Stamped<T> {
  activity: T
  importedAt: Date | null
  startedAt: Date | null
}

// Import time, never start time: a start-date comparison always falls before the
// sync that imported the row. The upsert moves `updatedAt`, so a correction stays read.
export class ActivityReadFeed<T extends ImportStampedActivity> {
  private constructor(
    readonly unread: readonly T[],
    readonly recent: readonly T[],
    readonly unreadCount: number,
    /** The newest import in the page — what "mark all read" stamps. */
    readonly latestImportInstant: Date | null,
  ) {}

  static of<T extends ImportStampedActivity>(
    activities: readonly T[],
    watermark: ActivityReadWatermark,
    limit: number,
  ): ActivityReadFeed<T> {
    const stamped: Stamped<T>[] = activities.map((activity) => ({
      activity,
      importedAt: importInstant(activity),
      startedAt: startInstant(activity),
    }))

    const unread = stamped
      .filter(hasImportTime)
      .filter((entry) => !watermark.covers(entry.importedAt))
      .sort((a, b) => b.importedAt.getTime() - a.importedAt.getTime())

    const recent = [...stamped].sort(
      (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
    )

    return new ActivityReadFeed(
      unread.slice(0, limit).map((entry) => entry.activity),
      recent.slice(0, limit).map((entry) => entry.activity),
      unread.length,
      unread[0]?.importedAt ?? null,
    )
  }

  get hasUnread(): boolean {
    return this.unreadCount > 0
  }
}

function hasImportTime<T>(entry: Stamped<T>): entry is Stamped<T> & { importedAt: Date } {
  return entry.importedAt !== null
}

/** Import creation time; `updatedAt` moves on every sync that re-sees the row. */
function importInstant(activity: ImportStampedActivity): Date | null {
  return toInstant(activity.createdAt)
}

function startInstant(activity: ImportStampedActivity): Date | null {
  return toInstant(activity.date) ?? toInstant(activity.start_date)
}

function toInstant(value: string | null | undefined): Date | null {
  if (!value) return null
  const instant = Date.parse(value)
  return Number.isNaN(instant) ? null : new Date(instant)
}
