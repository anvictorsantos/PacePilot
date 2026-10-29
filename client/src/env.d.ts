/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_PROXY_TARGET?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENV?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE?: string
  readonly VITE_SENTRY_DEBUG?: string
  readonly VITE_SENTRY_REPLAY_ENABLED?: string
  readonly VITE_SENTRY_IGNORE_ERRORS?: string
  readonly VITE_SENTRY_FORCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
