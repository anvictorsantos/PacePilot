export function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message)
  // cors allowlist denial carries no status — surface as 403, not 500.
  const status = err.message === 'CORS origin denied' ? 403 : err.status || err.statusCode || 500
  res.status(status).json({
    error: err.expose || status !== 500 ? err.message : 'Internal server error',
  })
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' })
}
