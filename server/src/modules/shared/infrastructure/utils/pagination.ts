const MAX_PER_PAGE = 100
const FALLBACK_PER_PAGE = 20

/**
 * `parsePagination(query, defaults)` previously fell back to a hard-coded 20
 * whenever the query was missing or unparseable, silently discarding the
 * caller's `defaults.perPage`. Non-numeric input ("?per_page=abc") still parsed
 * to 0 and was also swallowed rather than rejected.
 */
export function parsePagination(query, defaults = { page: 1, perPage: FALLBACK_PER_PAGE }) {
  const q = query || {}

  const parsedPage = Number.parseInt(q.page, 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : (defaults.page ?? 1)

  const rawPerPage = q.per_page ?? q.perPage
  const parsedPerPage = Number.parseInt(rawPerPage, 10)
  const requested = Number.isFinite(parsedPerPage) && parsedPerPage > 0
    ? parsedPerPage
    : (defaults.perPage ?? FALLBACK_PER_PAGE)

  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, requested))
  return { page, perPage, skip: (page - 1) * perPage, limit: perPage }
}
