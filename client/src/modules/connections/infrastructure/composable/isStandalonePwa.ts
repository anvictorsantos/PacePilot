// Installed app vs browser tab. Matters for OAuth: `window.open` from a home-screen
// app opens the system browser and the callback never comes back, so the flow stays same-window.
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  if (iosStandalone === true) return true
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false
}
