import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import { useSession } from '@/composables/useSession.js'
import { i18n } from '@/i18n/index.js'
import routes from '@/router/index.js'
import './assets/styles.css'

const router = createRouter({ history: createWebHistory(), routes })
const pinia = createPinia()

// Dashboard gate: public pages (landing, login) open to all, everything else
// requires a connected Strava session. Unauthenticated visits land on /login.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const { checkStatus } = useSession()
  const ok = await checkStatus()
  if (!ok) return { path: '/login', query: { next: to.fullPath } }
  return true
})

createApp(App).use(pinia).use(router).use(i18n).mount('#app')
