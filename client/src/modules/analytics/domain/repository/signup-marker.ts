/**
 * Local "counts only once" marks. A successful registration does not say whether this
 * browser was already counted, so the client keeps its own closest honest signal.
 */
export interface SignupMarker {
  /** True when a session has already been recorded on this browser. */
  sent(): boolean
  remember(): void
}
