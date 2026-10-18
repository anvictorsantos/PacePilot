import * as Sentry from '@sentry/vue'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import { useSession } from '@/composables/useSession.ts'
import { currentLocale, i18n, loadLocale } from '@/i18n/index.ts'
import routes from '@/router/index.ts'
import { captureException } from '@/services/logger.ts'
import './assets/styles.css'

const router = createRouter({ history: createWebHistory(), routes })

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
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

// Dashboard gate: public pages (landing, login) open to all, everything else
// requires a connected Strava session. Unauthenticated visits land on /login.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { checkStatus } = useSession()
  const ok = await checkStatus()
  if (!ok) return { path: '/login', query: { next: to.fullPath } }
  return true
})

const app = createApp(App)

if (sentryDsn) {
  const integrations = [Sentry.browserTracingIntegration({ router })]
  if (import.meta.env.VITE_SENTRY_REPLAY_ENABLED === 'true') {
    integrations.push(Sentry.replayIntegration())
  }

  Sentry.init({
    app,
    dsn: sentryDsn,
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

  Sentry.setTags({
    feature: 'application',
  })
}

// Avoid duplicate capture: Sentry's Vue integration already captures component/runtime errors.
// Keep a local development-only handler when Sentry is disabled.
app.config.errorHandler = (error) => {
  if (!sentryDsn) {
    captureException(error, { feature: 'vue-runtime', operation: 'app.config.errorHandler' })
  }
}

// pt ships in the entry chunk but a stored `en` is a separate one, so await the
// active catalogue before mounting: the first paint is never in the wrong language.
loadLocale(currentLocale())
  .catch((error) => captureException(error, { feature: 'i18n', operation: 'load' }))
  .finally(() => app.use(router).use(i18n).mount('#app'))
