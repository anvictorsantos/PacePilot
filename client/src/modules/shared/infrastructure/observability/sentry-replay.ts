/**
 * Replay is the heavy half of the Sentry bundle: `@sentry/browser` re-exports it
 * eagerly, so importing it from `main.ts` puts ~100 kB gzipped of session
 * recording in the SDK chunk for every visitor, even when the build disables it.
 *
 * Its own module means its own chunk: the SDK chunk stays lean, and replay is
 * fetched only when `VITE_SENTRY_REPLAY_ENABLED` is true.
 */
export async function loadReplayIntegration() {
  const { replayIntegration } = await import('@sentry/vue')
  return replayIntegration()
}
