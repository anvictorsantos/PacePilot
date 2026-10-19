/**
 * Port: drop the reads an import makes stale. The plan and progress are derived
 * from activities, so the moment new ones land every cached read of them lies.
 */
export interface ImportedActivitiesCache {
  invalidateAfterImport(): void
}
