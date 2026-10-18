/** A personal best surfaced on Progress (rename of the old `Record`, which
 *  shadowed TypeScript's own `Record` utility). */
export interface PersonalRecord {
  id?: number | string | null
  date?: string | null
  distance_km?: number | null
  pace?: number | null
}
