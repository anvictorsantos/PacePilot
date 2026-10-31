/** Port: drop reads an import makes stale — the plan and progress derive from activities. */
export interface ImportedActivitiesCache {
  invalidateAfterImport(): void
}
