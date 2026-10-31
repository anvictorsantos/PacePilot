/** Strava athlete-slot quota; drives the waitlist gate. */
export interface WaitlistCapacity {
  limit?: number | null
  used?: number | null
  full?: boolean | null
}
