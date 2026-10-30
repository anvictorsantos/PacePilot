/**
 * The one historical-import effect a pull sync needs: take the provider away
 * from a walk that is holding it. The cursor stays with the walk, so the next
 * step resumes from the same page instead of restarting the window.
 */
export interface BackfillPausePort {
  /** Pause a walk holding this athlete's provider; a finished run is left alone. */
  pauseRunning(athleteId: string, provider: string, at: Date): Promise<void>
}
