import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import { currentLocale, i18n, loadLocale } from '@/i18n/index.ts'
import { useAnalytics } from '@/modules/analytics/infrastructure/composable/useAnalytics.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { observabilityEnabled } from '@/modules/shared/infrastructure/observability/enabled.ts'
import {
  captureException,
  setObservabilitySink,
} from '@/modules/shared/infrastructure/observability/logger.ts'
import routes from '@/router/index.ts'
import './assets/styles.css'

const router = createRouter({ history: createWebHistory(), routes })

// Reporting is production-only unless explicitly forced: a dev build talks to a
// local server and a stale module graph, and those events used to arrive in the
// same project as the athlete's real failures. `VITE_SENTRY_FORCE=true` opts a
// dev build back in for verifying the integration.
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
})

// One page view per navigation, including the first — the router's initial
// resolve fires this too. The route *pattern* (`/activities/:id`) is sent rather
// than the path, so no activity id leaves the device, and the query string is
// never sent at all (`next=`, OAuth `error=`). Nothing is queued until the
// athlete grants consent; granting sends the visit that produced the answer.
const analytics = useAnalytics()

router.afterEach((to) => {
  analytics.trackPageView(to.matched[0]?.path ?? to.path)
})

// Dashboard gate: public pages (landing, login) open to all, everything else
// requires an account session. Strava is a link inside the app, not the gate.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { ensure } = useAuth()
  const ok = await ensure()
  if (!ok) return { path: '/login', query: { next: to.fullPath } }
  return true
})

const app = createApp(App)

// Sentry is the largest script on the critical path (~60 kB gzipped plus ~160 ms
// of scripting) and this is a SPA, so first paint waits for it. It loads once the
// first frame is done instead. The logger buffers everything captured in the
// meantime, and these listeners cover the boot errors Sentry's own global
// handlers would otherwise have caught.
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
  // tree-shaken, so `Sentry.replayIntegration` would keep session replay in the
  // SDK chunk forever.
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

// Idle alone is too early: the callback fires right after mount, so the SDK
// parses and evaluates while the font is still landing and pushes LCP out by a
// second. Wait for `load`, then for the paint to settle, before spending the
// main thread on observability.
// The SDK chunk shares the connection with the font and the entry bundle, and
// measurements put it on the wire before LCP costs ~250 ms of LCP. So it loads
// once the largest paint has settled, on the first interaction, or at a hard
// ceiling — whichever comes first. `logger` buffers whatever happens meanwhile.
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

// Avoid duplicate capture: Sentry's Vue integration already captures component/runtime errors.
// Keep a local handler until the SDK is ready (and always, when Sentry is disabled).
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
