/**
 * Is this window the installed app rather than a normal browser tab?
 *
 * Matters for OAuth: a home-screen app cannot reliably hand a child window back.
 * `window.open` there opens the system browser, and the provider's callback
 * redirect lands in that browser tab instead of returning to the app the athlete
 * launched. Same-window navigation keeps the round trip inside the app's own
 * browsing context.
 *
 * `navigator.standalone` is the iOS home-screen flag; `display-mode` covers
 * Android/desktop installs and is the standard when the manifest is honoured.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  if (iosStandalone === true) return true
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false
}
