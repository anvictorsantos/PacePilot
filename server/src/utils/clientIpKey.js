// Serverless-safe client key for express-rate-limit.
// Netlify Functions have no socket remoteAddress, so request.ip is undefined
// and the library's default keyGenerator throws ERR_ERL_UNDEFINED_IP_ADDRESS.
// This falls back through proxy headers; 'unknown' bucket is last resort
// (shared quota, but never crashes).
export function clientIpKey(req) {
  if (req?.ip) return req.ip
  const headers = req?.headers || {}
  const xff = headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
  const nfIp = headers['x-nf-client-connection-ip']
  if (typeof nfIp === 'string' && nfIp.trim()) return nfIp.trim()
  return 'unknown'
}
