// Namespaced by provider so one provider's callback can never satisfy another's
// cookie: the cookie holds `provider:state`, the query the raw echoed state.
export function oauthStateCookie(provider: string, state: string): string {
  return `${provider}:${state}`
}

export function isValidOAuthState(
  provider: string,
  state: unknown,
  cookie: unknown,
): boolean {
  return (
    typeof state === 'string' &&
    state.length > 0 &&
    typeof cookie === 'string' &&
    cookie === oauthStateCookie(provider, state)
  )
}
