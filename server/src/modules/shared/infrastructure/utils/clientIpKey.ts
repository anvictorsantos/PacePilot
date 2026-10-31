// Proxy-safe client key for express-rate-limit: request.ip, then the proxy
// header, then 'unknown' (a shared quota, but never a crash).
/** The slice of a request the key needs; structural so plain objects fit too. */
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
