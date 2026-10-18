import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser'

/** `GET /api/me` — `user: null` when signed out, never a 401. */
export interface CurrentUserResponse {
  user?: CurrentUser | null
}
