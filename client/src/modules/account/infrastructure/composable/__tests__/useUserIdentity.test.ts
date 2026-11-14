import { describe, expect, it } from 'vitest'

import { identityFrom } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'

const sessionAthlete = {
  firstname: 'Ana',
  lastname: 'Silva',
  email: 'ana@example.com',
  profile: 'https://example.com/ana.jpg',
}

describe('identityFrom', () => {
  it('falls back to the session when the /me probe has not answered', () => {
    // The reported bug: /me fails or is still pending, and the header shows the
    // fallback initials until a hard refresh. The session already has the athlete.
    expect(identityFrom(null, sessionAthlete)).toEqual(sessionAthlete)
    expect(identityFrom(undefined, sessionAthlete)).toEqual(sessionAthlete)
  })

  it('prefers a completed /me read', () => {
    const fresher = { ...sessionAthlete, profile: 'https://example.com/new.jpg' }
    expect(identityFrom(fresher, sessionAthlete)).toEqual(fresher)
  })

  it('stays null when neither source has an athlete', () => {
    expect(identityFrom(null, null)).toBeNull()
    expect(identityFrom(undefined, undefined)).toBeNull()
  })
})
