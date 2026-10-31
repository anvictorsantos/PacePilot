// Carries the HTTP status, whether the message is safe to show a client, and an
// optional code. `expose` defaults to `status < 500`, so no 5xx can leak internals.
export class AppError extends Error {
  readonly status: number
  readonly expose: boolean
  readonly code: string | null

  constructor(
    message: string,
    {
      status = 500,
      expose,
      code = null,
      cause,
    }: { status?: number; expose?: boolean; code?: string | null; cause?: unknown } = {}
  ) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = 'AppError'
    this.status = status
    this.expose = expose ?? status < 500
    this.code = code
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export const badRequest = (message: string, code?: string) =>
  new AppError(message, { status: 400, code })
export const unauthorized = (message = 'Not authenticated') =>
  new AppError(message, { status: 401, code: 'unauthorized' })
export const notFound = (message = 'Not found') =>
  new AppError(message, { status: 404, code: 'not_found' })
export const rateLimited = (message = 'Too many requests', code?: string) =>
  new AppError(message, { status: 429, code })
export const serviceUnavailable = (message = 'Service unavailable', cause?: unknown) =>
  new AppError(message, { status: 503, code: 'unavailable', cause })
