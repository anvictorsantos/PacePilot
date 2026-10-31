/** Read keys for the Resource module, declared once so a subscriber and a view cannot drift. */
export const RESOURCE_KEYS = {
  planWeek: 'plan.week',
  progress: 'progress.summary',
  connectionStatus: 'connection.status',
  providers: 'providers.list',
  currentUser: 'account.current',
  waitlistCapacity: 'waitlist.capacity',
} as const

export type ResourceKey = (typeof RESOURCE_KEYS)[keyof typeof RESOURCE_KEYS]
