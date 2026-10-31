/** One linked position between the pace/HR chart and the 3D route. */
export interface ActivitySamplePoint {
  distanceKm: number
  paceSecKm: number | null
  hr: number | null
}
