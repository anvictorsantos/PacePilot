/** One linked position between the pace/HR chart and the 3D route. */
export interface ActivitySamplePoint {
  /** Distance from the start, in kilometres. */
  distanceKm: number
  /** Pace at that sample, seconds per kilometre. */
  paceSecKm: number | null
  hr: number | null
}
