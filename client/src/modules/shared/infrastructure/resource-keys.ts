/**
 * The keys the Resource module is read under. They were string literals at every
 * call site, which meant a subscriber invalidating `plan.week` could silently
 * stop matching the view reading `plan-week`. One declaration.
 */
export const RESOURCE_KEYS = {
  planWeek: 'plan.week',
  progress: 'progress.summary',
  connectionStatus: 'connection.status',
  providers: 'providers.list',
  currentUser: 'account.current',
  waitlistCapacity: 'waitlist.capacity',
} as const

export type ResourceKey = (typeof RESOURCE_KEYS)[keyof typeof RESOURCE_KEYS]
