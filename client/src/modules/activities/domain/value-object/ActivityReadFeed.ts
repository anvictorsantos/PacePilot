import { ActivityReadWatermark } from '@/modules/activities/domain/value-object/ActivityReadWatermark'

/**
 * What a notification row must carry for the feed to place it in time. It is
 * declared here rather than imported from the HTTP DTO: the rule is domain
 * vocabulary, and the transport shape is free to change around it.
 */
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

/**
 * What the panel shows: the activities imported since the athlete last looked,
 * and the newest activities regardless.
 *
 * ## The rule is import time, never start time
 *
 * An activity's `date` is when the athlete ran it. A sync that imports it runs
 * afterwards, always, so "started after the last sync" is false by construction
 * — that comparison is what left the panel empty straight after a successful
 * import. The feed compares `createdAt` instead: the moment our row was created,
 * i.e. the moment the import landed.
 *
 * ## Corrections are not new (documented decision)
 *
 * A provider correction re-imports an activity that already exists. The upsert
 * moves `updatedAt` on every sync that sees the row again, `createdAt` does not,
 * and the activity stays read: the athlete has already seen it, so a routine
 * sync must not look like it found something.
 *
 * A row with no `createdAt` is never unread either — the rule cannot tell when
 * it was imported, and reading `updatedAt` instead would light the bell on every
 * enrichment. It still appears among the recent activities.
 */
export class ActivityReadFeed<T extends ImportStampedActivity> {
  /** How many rows the panel lists; the count still reports every unread one. */
  static readonly RECENT_LIMIT = 6

  private constructor(
    /** Imported after the watermark, newest import first, capped at the limit. */
    readonly unread: readonly T[],
    /** The newest activities by start date, whether read or not. */
    readonly recent: readonly T[],
    /** Every unread row, including those the cap kept off screen. */
    readonly unreadCount: number,
    /** The newest import anywhere in the page — the value "mark all read" stamps. */
    readonly latestImportInstant: Date | null,
  ) {}

  static of<T extends ImportStampedActivity>(
    activities: readonly T[],
    watermark: ActivityReadWatermark,
    limit: number = ActivityReadFeed.RECENT_LIMIT,
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

/** When the import created the row. `updatedAt` is deliberately not read: a
 *  correction moves it on every sync that sees the row again. */
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
