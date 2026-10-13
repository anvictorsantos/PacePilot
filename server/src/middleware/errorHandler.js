export function errorHandler(err, _req, res, _next) {
  console.error('[error]', err.message)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    error: err.expose ? err.message : status === 500 ? 'Internal server error' : err.message,
  })
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' })
}
