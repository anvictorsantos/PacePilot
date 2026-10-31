export interface CurrentUser {
  /** The athlete id behind the session — the key per-account browser state uses. */
  id?: string | null
  firstname?: string | null
  lastname?: string | null
  email?: string | null
  profile?: string | null
}
