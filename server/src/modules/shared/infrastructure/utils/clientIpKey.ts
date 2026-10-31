// Proxy-safe client key for express-rate-limit.
// If Express did not populate request.ip, fall back through the proxy header;
// 'unknown' is the last resort (shared quota, but never crashes).
/** The slice of a request the key needs; structural so plain objects and the
 *  Express `Request` both fit. */
interface IpSource {
  ip?: string
  headers?: Record<string, string | string[] | undefined>
}

export function clientIpKey(req?: IpSource | null): string {
  if (req?.ip) return req.ip
  const headers = req?.headers || {}
  const xff = headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
  return 'unknown'
}
