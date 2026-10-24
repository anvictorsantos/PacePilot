import { ref } from 'vue'

/**
 * Remount key for the current route view. Bumping it re-runs every `useResource`
 * read without a browser reload, which is how the app picks up newly synced
 * Strava data after an in-app connection.
 */
const version = ref(0)

export function appRefreshVersion() {
  return version
}

export function triggerAppRefresh(): void {
  version.value += 1
}
