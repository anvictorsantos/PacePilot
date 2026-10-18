/** Phase / taper context for the programme the week sits in. */
export interface PlanProgramme {
  phase?: string | null
  weeks_out?: number | null
  cutback?: boolean
  taper?: boolean
  long_run_km?: number | null
  long_run_target_km?: number | null
  notes?: string[]
}
