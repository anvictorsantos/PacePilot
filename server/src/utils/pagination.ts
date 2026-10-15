export function parsePagination(query, defaults = { page: 1, perPage: 20 }) {
  const page = Math.max(1, parseInt(query.page || defaults.page, 10) || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(query.per_page || query.perPage || defaults.perPage, 10) || 20))
  return { page, perPage, skip: (page - 1) * perPage, limit: perPage }
}
