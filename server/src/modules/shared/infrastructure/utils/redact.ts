// Scrub secrets before they reach logs. Inputs may be Error/message/string.
export function redactSecrets(input) {
  if (input == null) return input
  const s = typeof input === 'string' ? input : String(input?.message ?? input)
  return s
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:access_token|refresh_token|client_secret|jwt_secret|api_key))\b\s*["':=]+\s*[^&"'\s,}]+/gi, '$1=[REDACTED]')
    .replace(/([?&](?:access_token|code|state)=)[^&"'\s]*/gi, '$1[REDACTED]')
}
