/**
 * Replay is the heavy half of the Sentry bundle, re-exported eagerly by `@sentry/browser`;
 * its own module keeps the SDK chunk lean and loads it only with VITE_SENTRY_REPLAY_ENABLED.
 */
export async function loadReplayIntegration() {
  const { replayIntegration } = await import('@sentry/vue')
  return replayIntegration()
}
