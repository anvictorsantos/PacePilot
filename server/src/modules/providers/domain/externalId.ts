/** Strava's `id_str` is authoritative; the numeric `id` loses precision past 2^53. */
export function providerIdString(
  idStr: string | null | undefined,
  id: number | null | undefined,
): string {
  if (idStr) return idStr
  return id == null ? '' : String(id)
}

/** Legacy numeric columns only ever held safe integers, so a wider id must not be coerced. */
export function legacyNumericId(externalId: string): number | undefined {
  if (!/^\d+$/.test(externalId)) return undefined
  const value = Number(externalId)
  return Number.isSafeInteger(value) && String(value) === externalId ? value : undefined
}
