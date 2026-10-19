/**
 * Data-access module — the one place that knows how to talk to the server.
 *
 * Before this module, seven sibling files restated the same one-line shape
 * (`const { data } = await api.get<T>(path); return data ?? {}`), each with its
 * own path literal and its own guess at the empty value, and the transport
 * underneath carried an interface as wide as its implementation. Nothing varied
 * at those seams, so they bought no leverage: every caller still had to know the
 * path, the verb and the unwrap convention.
 *
 * Now the interface is the domain: `api.plan.week()`, `api.strava.status()`. The
 * path registry, the unwrap-plus-fallback convention, the error classification
 * and the Sentry reporting are implementation. `apiErrorMessage()` replaces the
 * `e.response?.data?.error || t(...)` idiom repeated at every call site.
 */
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

import type { CurrentUser } from '@/modules/account/infrastructure/dto/CurrentUser.ts'
import type { CurrentUserResponse } from '@/modules/account/infrastructure/dto/CurrentUserResponse.ts'
import type { ActivitiesResponse } from '@/modules/activities/infrastructure/dto/ActivitiesResponse.ts'
import type { Activity } from '@/modules/activities/infrastructure/dto/Activity.ts'
import type { AiStatusResponse } from '@/modules/ai/infrastructure/dto/AiStatusResponse.ts'
import type { PlanAiWeekResponse } from '@/modules/ai/infrastructure/dto/PlanAiWeekResponse.ts'
import type { PlanFeedback } from '@/modules/feedback/infrastructure/dto/PlanFeedback.ts'
import type { Goal } from '@/modules/goals/infrastructure/dto/Goal.ts'
import type { ProgressResponse } from '@/modules/progress/infrastructure/dto/ProgressResponse.ts'
import { captureException } from '@/modules/shared/infrastructure/observability/logger.ts'
import type { StravaStatus } from '@/modules/strava/infrastructure/dto/StravaStatus.ts'
import type { SyncResult } from '@/modules/strava/infrastructure/dto/SyncResult.ts'
import type { PlanTodayResponse } from '@/modules/training/infrastructure/dto/PlanTodayResponse.ts'
import type { PlanWeekResponse } from '@/modules/training/infrastructure/dto/PlanWeekResponse.ts'
import type { WaitlistCapacity } from '@/modules/waitlist/infrastructure/dto/WaitlistCapacity.ts'

/** Every server path the client knows. */
const ROUTES = {
  activities: '/activities',
  activity: (id: string | number) => `/activities/${id}`,
  currentUser: '/me',
  goals: '/goals',
  planWeek: '/plan/week',
  planToday: '/plan/today',
  planFeedback: '/plan/feedback',
  planAiWeek: '/plan/ai/week',
  planAiStatus: '/plan/ai/status',
  progress: '/progress',
  stravaStatus: '/strava/status',
  stravaSync: '/strava/sync',
  stravaDisconnect: '/strava/disconnect',
  waitlistCapacity: '/waitlist/capacity',
  waitlist: '/waitlist',
} as const

/** Transport. Exposed for this module's own tests — callers use `api`. */
export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

/** 5xx, offline and timeouts are our problem; 4xx is the caller's. */
function isReportable(error: AxiosError): boolean {
  if (!error.response) return true // network/connectivity/timeout
  if (error.code === 'ECONNABORTED') return true
  return error.response.status >= 500
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as AxiosError
    if (isReportable(axiosError)) {
      const method = axiosError.config?.method?.toUpperCase() || 'UNKNOWN'
      const url = axiosError.config?.url || 'unknown'
      captureException(axiosError, {
        feature: 'http-client',
        operation: `${method} ${url}`,
        status: axiosError.response?.status ?? null,
        code: axiosError.code ?? null,
      })
    }
    // don't throw raw errors to UI; let callers handle
    return Promise.reject(error)
  },
)

/**
 * Unwrap a response, falling back to `empty` when the server sends no body.
 * The one place the `?? {}` / `?? null` convention lives.
 */
async function request<T>(config: AxiosRequestConfig, empty: T): Promise<T> {
  const { data } = await http.request<T>(config)
  return (data ?? empty) as T
}

function read<T>(url: string, empty: T, params?: Record<string, unknown>): Promise<T> {
  return request<T>({ method: 'GET', url, params }, empty)
}

function send<T>(method: 'POST' | 'PUT', url: string, empty: T, payload?: unknown): Promise<T> {
  return request<T>({ method, url, data: payload }, empty)
}

/**
 * The human-readable reason a request failed: the server's own `error` field
 * when there is one, otherwise the caller's localized fallback.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const body = (error as { response?: { data?: { error?: unknown } } })?.response?.data
  const message = body?.error
  return typeof message === 'string' && message ? message : fallback
}

export const api = {
  activities: {
    list(params: Record<string, unknown> = {}): Promise<ActivitiesResponse> {
      return read<ActivitiesResponse>(ROUTES.activities, {}, params)
    },
    get(id: string | number): Promise<Activity | null> {
      return read<Activity | null>(ROUTES.activity(id), null)
    },
  },
  plan: {
    week(): Promise<PlanWeekResponse> {
      return read<PlanWeekResponse>(ROUTES.planWeek, {})
    },
    today(): Promise<PlanTodayResponse> {
      return read<PlanTodayResponse>(ROUTES.planToday, {})
    },
    feedback(): Promise<PlanFeedback[] | null> {
      return read<PlanFeedback[] | null>(ROUTES.planFeedback, null)
    },
    submitFeedback(payload: Record<string, unknown>): Promise<unknown> {
      return send<unknown>('POST', ROUTES.planFeedback, null, payload)
    },
    /**
     * AI coaching copy for the deterministic week. Separate call so the plan
     * renders instantly without spending provider quota. Resolves with
     * `degraded` set when AI is unavailable — normal outcome, not an error.
     */
    aiWeek(): Promise<PlanAiWeekResponse> {
      return read<PlanAiWeekResponse>(ROUTES.planAiWeek, {})
    },
    /** Free-tier health: whether the configured model is still in the free catalog. */
    aiStatus(): Promise<AiStatusResponse> {
      return read<AiStatusResponse>(ROUTES.planAiStatus, {})
    },
  },
  progress: {
    summary(): Promise<ProgressResponse> {
      return read<ProgressResponse>(ROUTES.progress, {})
    },
  },
  goals: {
    get(): Promise<Goal | null> {
      return read<Goal | null>(ROUTES.goals, null)
    },
    save(payload: Record<string, unknown>): Promise<Goal | null> {
      return send<Goal | null>('PUT', ROUTES.goals, null, payload)
    },
  },
  strava: {
    status(): Promise<StravaStatus> {
      return read<StravaStatus>(ROUTES.stravaStatus, {})
    },
    sync(force = false): Promise<SyncResult> {
      return send<SyncResult>(
        'POST',
        force ? `${ROUTES.stravaSync}?force=1` : ROUTES.stravaSync,
        {},
      )
    },
    async disconnect(): Promise<void> {
      await http.post(ROUTES.stravaDisconnect)
    },
  },
  account: {
    current(): Promise<CurrentUser | null> {
      return read<CurrentUserResponse>(ROUTES.currentUser, {}).then((data) => data.user || null)
    },
    async delete(): Promise<void> {
      await http.delete(ROUTES.currentUser)
    },
  },
  waitlist: {
    capacity(): Promise<WaitlistCapacity> {
      return read<WaitlistCapacity>(ROUTES.waitlistCapacity, {})
    },
    join(email: string): Promise<unknown> {
      return send<unknown>('POST', ROUTES.waitlist, null, { email })
    },
  },
}
