import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import { currentLocale, i18n, loadLocale } from '@/i18n/index.ts'
import { useAnalytics } from '@/modules/analytics/infrastructure/composable/useAnalytics.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { isTransportFailure } from '@/modules/shared/infrastructure/http/client.ts'
import { observabilityEnabled } from '@/modules/shared/infrastructure/observability/enabled.ts'
import {
  captureException,
  setObservabilitySink,
} from '@/modules/shared/infrastructure/observability/logger.ts'
import {
  isChunkLoadError,
  onModulePreloadError,
  reloadOnce,
} from '@/modules/shared/infrastructure/router/chunk-recovery.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'
import routes from '@/router/index.ts'
import './assets/styles.css'

const router = createRouter({ history: createWebHistory(), routes })

// Long enough for the Sentry event to leave the page, short enough that the
// athlete does not register the dead screen.
const CHUNK_RECOVERY_DELAY_MS = 250

// Reporting is production-only unless `VITE_SENTRY_FORCE=true`: a dev build
// talks to a local server and floods the athlete's real project with its errors.
const sentryDsn = observabilityEnabled({
  prod: import.meta.env.PROD,
  force: import.meta.env.VITE_SENTRY_FORCE,
})
  ? import.meta.env.VITE_SENTRY_DSN
  : undefined
const tracesSampleRate = Number(
  import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? (import.meta.env.PROD ? 0.1 : 1),
)
const replaySessionSampleRate = Number(
  import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? (import.meta.env.PROD ? 0.1 : 1),
)
const replayOnErrorSampleRate = Number(
  import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 1,
)
const ignoreErrors = (import.meta.env.VITE_SENTRY_IGNORE_ERRORS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

router.onError((error) => {
  captureException(error, { feature: 'router', operation: 'navigation' })
  // A route chunk from the previous deploy is gone: report it, then reload into
  // the current index.html once, after the event has left the page.
  if (isChunkLoadError(error)) {
    window.setTimeout(() => reloadOnce(), CHUNK_RECOVERY_DELAY_MS)
  }
})

// Vite raises this before it rethrows; `preventDefault` keeps it out of the
// console and the reload into the current index.html is the recovery.
window.addEventListener('vite:preloadError', (event) => {
  onModulePreloadError(event, {
    report: (payload) =>
      captureException(payload, { feature: 'router', operation: 'module-preload' }),
    reload: () => window.setTimeout(() => reloadOnce(), CHUNK_RECOVERY_DELAY_MS),
  })
})

// One page view per navigation, including the first. Only the route *pattern*
// (`/activities/:id`) is sent, never an id or the query string, and nothing is
// queued until consent is granted.
const analytics = useAnalytics()

router.afterEach((to) => {
  analytics.trackPageView(to.matched[0]?.path ?? to.path)
})

// Strava is a link inside the app, not the auth gate; public routes opt out via `meta.public`.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { ensure, error } = useAuth()
  const ok = await ensure()
  if (ok) return true
  // A probe that never reached the server is not a signed-out athlete: same
  // redirect, different reason.
  if (isTransportFailure(error.value)) {
    useToast().show(i18n.global.t('auth.error.offline'), { type: ToastType.Warning })
  }
  return { path: '/login', query: { next: to.fullPath } }
})

const app = createApp(App)

// Sentry is the largest script on the critical path and this SPA's first paint
// would wait for it, so it loads after the first frame. The logger buffers
// meanwhile; these listeners cover the boot errors Sentry would have caught.
let sentryReady = false

const onWindowError = (event: ErrorEvent) => {
  if (sentryReady) return
  captureException(event.error ?? event.message, { feature: 'window', operation: 'bootstrap' })
}
const onUnhandledRejection = (event: PromiseRejectionEvent) => {
  if (sentryReady) return
  captureException(event.reason, { feature: 'unhandledrejection', operation: 'bootstrap' })
}

if (sentryDsn) {
  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
}

async function initSentry(dsn: string) {
  // Named destructuring, not a namespace import: a namespace object cannot be
  // tree-shaken, so replay would stay in the SDK chunk forever.
  const {
    addBreadcrumb,
    browserTracingIntegration,
    captureException: captureSentryException,
    captureMessage: captureSentryMessage,
    init,
    setTags,
  } = await import('@sentry/vue')

  const integrations = [browserTracingIntegration({ router })]
  if (import.meta.env.VITE_SENTRY_REPLAY_ENABLED === 'true') {
    const { loadReplayIntegration } =
      await import('@/modules/shared/infrastructure/observability/sentry-replay.ts')
    integrations.push(await loadReplayIntegration())
  }

  init({
    app,
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    debug: import.meta.env.VITE_SENTRY_DEBUG === 'true',
    integrations,
    tunnel: '/api/sentry/tunnel',
    tracesSampleRate,
    tracePropagationTargets: ['localhost', /\/api/],
    replaysSessionSampleRate: replaySessionSampleRate,
    replaysOnErrorSampleRate: replayOnErrorSampleRate,
    ignoreErrors,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization
        delete event.request.headers.authorization
        delete event.request.headers.Cookie
        delete event.request.headers.cookie
      }
      return event
    },
  })

  setTags({
    feature: 'application',
  })

  // Attaching the sink flushes what the logger buffered while the SDK loaded.
  setObservabilitySink({
    captureException: (error, options) =>
      captureSentryException(error, {
        tags: options.tags,
        ...(options.extra !== undefined ? { extra: options.extra } : {}),
      }),
    captureMessage: (message, options) =>
      captureSentryMessage(message, {
        level: 'info',
        tags: options.tags,
        ...(options.extra !== undefined ? { extra: options.extra } : {}),
      }),
    addBreadcrumb: (breadcrumb) => addBreadcrumb(breadcrumb),
  })

  sentryReady = true
  window.removeEventListener('error', onWindowError)
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
}

// Idle is too early (it fires right after mount) and the SDK chunk competes with
// the font for the connection, costing ~250 ms of LCP. So: wait for `load`, then
// for the largest paint to settle, on first interaction, or at a hard ceiling.
const whenPaintSettled = (task: () => void) => {
  let started = false
  let settleTimer = 0
  let ceiling = 0

  const run = () => {
    if (started) return
    started = true
    observer?.disconnect()
    window.clearTimeout(settleTimer)
    window.clearTimeout(ceiling)
    window.removeEventListener('pointerdown', run)
    window.removeEventListener('keydown', run)
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => task(), { timeout: 1000 })
      return
    }
    window.setTimeout(task, 0)
  }

  let observer: PerformanceObserver | undefined
  try {
    observer = new PerformanceObserver(() => {
      // Every new LCP candidate resets the window; 500 ms without one is settled.
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(run, 500)
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    observer = undefined
  }

  ceiling = window.setTimeout(run, 5000)
  window.addEventListener('pointerdown', run, { once: true })
  window.addEventListener('keydown', run, { once: true })
}

// Sentry's Vue integration already captures component/runtime errors; this covers
// the window before the SDK is ready, and every error when Sentry is disabled.
app.config.errorHandler = (error) => {
  if (sentryReady) return
  captureException(error, { feature: 'vue-runtime', operation: 'app.config.errorHandler' })
}

// pt ships in the entry chunk but a stored `en` is a separate one, so await the
// active catalogue before mounting: the first paint is never in the wrong language.
loadLocale(currentLocale())
  .catch((error) => captureException(error, { feature: 'i18n', operation: 'load' }))
  .finally(() => {
    app.use(router).use(i18n).mount('#app')
    if (!sentryDsn) return
    whenPaintSettled(() => {
      void initSentry(sentryDsn).catch((error) =>
        captureException(error, { feature: 'sentry', operation: 'init' }),
      )
    })
  })
