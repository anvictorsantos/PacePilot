const MAX_PER_PAGE = 100
const FALLBACK_PER_PAGE = 20

/**
 * `parsePagination(query, defaults)` previously fell back to a hard-coded 20
 * whenever the query was missing or unparseable, silently discarding the
 * caller's `defaults.perPage`. Non-numeric input ("?per_page=abc") still parsed
 * to 0 and was also swallowed rather than rejected.
 */
export function parsePagination(
  query?: Record<string, unknown> | null,
  defaults: { page?: number; perPage?: number } = { page: 1, perPage: FALLBACK_PER_PAGE },
) {
  const q = query || {}

  // String() first: query values are untrusted and may be arrays/objects, and
  // parseInt would coerce them the same way. Non-numeric input still → NaN.
  const parsedPage = Number.parseInt(String(q.page), 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : (defaults.page ?? 1)

  const rawPerPage = q.per_page ?? q.perPage
  const parsedPerPage = Number.parseInt(String(rawPerPage), 10)
  const requested = Number.isFinite(parsedPerPage) && parsedPerPage > 0
    ? parsedPerPage
    : (defaults.perPage ?? FALLBACK_PER_PAGE)

  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, requested))
  return { page, perPage, skip: (page - 1) * perPage, limit: perPage }
}
