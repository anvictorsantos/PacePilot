<template>
  <div class="flex flex-col gap-5">
    <div class="flex justify-between items-start gap-6">
      <div>
        <p class="mb-1.5 font-mono text-faint text-label">
          {{ (currentUser?.email || $t('settings.profile.desc')) + ' · ' + timezone }}
        </p>
        <h1 class="font-medium text-page text-primary leading-none tracking-tight">
          {{ $t('settings.title') }}
        </h1>
      </div>
      <div class="font-mono text-label text-muted text-right leading-relaxed whitespace-nowrap">
        <template v-if="weekMeta">
          {{ $t('common.week') }} {{ weekMeta.currentWeek }} {{ $t('common.of') }}
          {{ weekMeta.totalWeeks }}<br />
        </template>
        {{ $t('settings.strava.title') }} · {{ runCount }} {{ $t('goals.display.runs') }}
      </div>
    </div>

    <div class="items-start gap-5 grid lg:grid-cols-[1fr_320px]">
      <div class="flex flex-col gap-5 min-w-0">
        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-primary text-sm">{{ $t('ui.profile_title') }}</h3>
          <p class="mt-1 mb-5 text-body text-faint">{{ $t('settings.profile.hint') }}</p>

          <div class="gap-4 grid sm:grid-cols-2">
            <label
              for="settings-name"
              class="flex flex-col gap-1.5"
            >
              <span class="text-label text-muted">{{ $t('settings.profile.displayName') }}</span>
              <input
                id="settings-name"
                :value="fullName"
                readonly
                class="bg-cardSecondary px-3 py-2.5 border border-white/20 rounded-lg text-body text-muted"
              />
            </label>
            <label
              for="settings-name"
              class="flex flex-col gap-1.5"
            >
              <span class="text-label text-muted">{{ $t('settings.account.email') }}</span>
              <input
                :value="currentUser?.email || ''"
                readonly
                class="bg-cardSecondary px-3 py-2.5 border border-white/20 rounded-lg text-body text-muted"
              />
            </label>
            <label
              for="settings-timezone"
              class="flex flex-col gap-1.5 sm:col-span-2"
            >
              <span class="text-label text-muted">{{ $t('settings.timezone') }}</span>
              <input
                id="settings-timezone"
                :value="timezone"
                readonly
                class="bg-cardSecondary px-3 py-2.5 border border-white/20 rounded-lg text-body text-muted"
              />
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-3 mt-4 text-label">
            <span :class="emailVerified ? 'text-success' : 'text-warning'">
              {{ emailVerified ? $t('settings.email.verified') : $t('settings.email.unverified') }}
            </span>
            <button
              v-if="!emailVerified"
              type="button"
              class="disabled:opacity-60 text-primary hover:underline transition cursor-pointer disabled:cursor-not-allowed"
              :disabled="resendingVerification"
              @click="resendVerification"
            >
              {{
                resendingVerification ? $t('settings.email.resending') : $t('settings.email.resend')
              }}
            </button>
            <span
              v-if="verificationSent"
              class="text-success"
              role="status"
            >
              {{ $t('settings.email.resent') }}
            </span>
          </div>
          <p class="mt-3 text-faint text-label">{{ $t('settings.profile.readonly') }}</p>
        </div>

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-primary text-sm">{{ $t('settings.connections.title') }}</h3>
          <p class="mt-1 mb-2 text-body text-faint">{{ $t('settings.strava.desc') }}</p>

          <div class="flex justify-between items-center gap-5 py-3">
            <div>
              <div class="text-body text-primary">{{ $t('settings.strava.title') }}</div>
              <div class="mt-0.5 text-faint text-label">
                <span
                  class="inline-block bg-accent mr-1.5 rounded-full w-1.5 h-1.5 align-[1px]"
                  aria-hidden="true"
                ></span>
                {{
                  stravaConnected
                    ? $t('connection.status.connected')
                    : $t('connection.status.notConnected')
                }}
              </div>
            </div>
            <div class="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <button
                v-if="!stravaConnected"
                type="button"
                class="px-3.5 py-2 border border-white/20 rounded-lg text-body text-muted hover:text-primary transition cursor-pointer"
                @click="openConnect"
              >
                {{ $t('settings.strava.connect') }}
              </button>
              <template v-else>
                <button
                  type="button"
                  :disabled="syncing"
                  class="disabled:opacity-50 px-3.5 py-2 border border-white/20 rounded-lg text-body text-muted hover:text-primary transition cursor-pointer disabled:cursor-not-allowed"
                  @click="syncNow"
                >
                  {{ syncing ? $t('common.saving') : $t('settings.connections.syncNow') }}
                </button>
                <button
                  :disabled="disconnecting"
                  class="disabled:opacity-50 px-3.5 py-2 border border-white/20 rounded-lg text-body text-muted hover:text-primary transition cursor-pointer disabled:cursor-not-allowed"
                  @click="disconnectStrava"
                >
                  {{
                    disconnecting
                      ? $t('settings.strava.disconnecting')
                      : $t('settings.strava.disconnect')
                  }}
                </button>
              </template>
            </div>
          </div>
        </div>

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-primary text-sm">{{ $t('settings.coaching.title') }}</h3>
          <p class="mt-1 mb-2 text-body text-faint">{{ $t('settings.coaching.hint') }}</p>

          <div
            v-for="row in coachingRows"
            :key="row.key"
            class="flex justify-between items-center gap-5 py-3.5 border-white/10 last:border-0 border-b"
          >
            <div>
              <div class="text-body text-primary">{{ row.title }}</div>
              <div class="mt-0.5 text-faint text-label">{{ row.desc }}</div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="coachingValue(row.key)"
              :aria-label="row.title"
              class="relative border rounded-full w-9 h-5 transition cursor-pointer shrink-0"
              :class="
                coachingValue(row.key)
                  ? 'bg-primary border-primary'
                  : 'bg-[#26262e] border-white/20'
              "
              :disabled="pushBusy || savingPreferences"
              @click="toggleCoaching(row.key)"
            >
              <span
                class="top-0.5 left-0.5 absolute rounded-full w-3.5 h-3.5 transition-transform"
                :class="
                  coachingValue(row.key) ? 'translate-x-4 bg-background' : 'translate-x-0 bg-muted'
                "
              ></span>
            </button>
          </div>
        </div>

        <div class="bg-card p-6 border border-white/10 rounded-xl">
          <h3 class="font-medium text-primary text-sm">{{ $t('settings.language.title') }}</h3>
          <p class="mt-1 mb-2 text-body text-faint">{{ $t('settings.language.hint') }}</p>
          <div class="flex justify-between items-center gap-5 pt-2">
            <div>
              <div class="text-body text-primary">{{ $t('settings.language.interface') }}</div>
              <div class="mt-0.5 text-faint text-label">
                {{ $t('settings.language.interfaceDesc') }}
              </div>
            </div>
            <LanguageSwitcher
              full
              class="p-0.5 border border-white/20 rounded-lg shrink-0"
            />
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 min-w-0">
        <div
          v-if="currentUser"
          class="bg-card p-4.5 border border-white/10 rounded-xl"
        >
          <h4 class="mb-2 font-medium text-body text-primary">
            {{ $t('settings.account.title') }}
          </h4>
          <div
            class="flex justify-between items-baseline gap-4 py-2 border-white/10 border-b text-body"
          >
            <span class="text-faint">{{ $t('settings.account.name') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ fullName }}</span>
          </div>
          <div
            class="flex justify-between items-baseline gap-4 py-2 border-white/10 border-b text-body"
          >
            <span class="text-faint">{{ $t('settings.account.memberSince') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ memberSince }}</span>
          </div>
          <div
            class="flex justify-between items-baseline gap-4 py-2 border-white/10 border-b text-body"
          >
            <span class="text-faint">{{ $t('settings.account.timezone') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ timezone }}</span>
          </div>
          <div class="flex justify-between items-baseline gap-4 py-2 text-body">
            <span class="text-faint">{{ $t('settings.account.provider') }}</span>
            <span class="font-mono text-label text-primary text-right">{{ providerLabel }}</span>
          </div>
        </div>

        <div class="bg-card p-4.5 border border-white/10 rounded-xl">
          <h4 class="mb-3 font-medium text-body text-primary">
            {{ $t('settings.session.title') }}
          </h4>
          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="px-4 py-2 border border-white/20 rounded-lg w-full text-body text-muted hover:text-primary transition cursor-pointer"
              @click="logout"
            >
              {{ $t('shell.logout') }}
            </button>
          </div>
        </div>

        <div
          v-if="currentUser"
          id="delete-account"
          class="bg-card p-4.5 border border-white/10 rounded-xl scroll-mt-6"
        >
          <h4 class="mb-2 font-medium text-body text-primary">{{ $t('settings.delete.title') }}</h4>
          <p class="mb-3 text-faint text-label leading-normal">{{ $t('settings.delete.desc') }}</p>
          <button
            v-if="!confirming"
            class="px-4 py-2 border border-danger/45 rounded-lg w-full text-body text-danger transition cursor-pointer"
            @click="confirming = true"
          >
            {{ $t('settings.delete.button') }}
          </button>
          <div
            v-else
            class="flex flex-col gap-2"
          >
            <button
              :disabled="erasing"
              class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 rounded-lg text-background text-body transition cursor-pointer disabled:cursor-not-allowed"
              @click="erase"
            >
              {{ erasing ? $t('settings.delete.erasing') : $t('settings.delete.confirm') }}
            </button>
            <button
              :disabled="erasing"
              class="px-4 py-2 border border-white/20 rounded-lg text-body text-muted transition cursor-pointer disabled:cursor-not-allowed"
              @click="confirming = false"
            >
              {{ $t('settings.delete.keep') }}
            </button>
          </div>
          <p
            v-if="error"
            class="mt-3 text-dangerBright text-label"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { useCoachingPreferences } from '@/modules/account/infrastructure/composable/useCoachingPreferences.ts'
import { useCurrentUser } from '@/modules/account/infrastructure/composable/useCurrentUser.ts'
import { useLogout } from '@/modules/account/infrastructure/composable/useLogout.ts'
import { useUserIdentity } from '@/modules/account/infrastructure/composable/useUserIdentity.ts'
import { disablePush, enablePush } from '@/modules/account/infrastructure/push/webPush.ts'
import { forgetActivityReadWatermark } from '@/modules/activities/infrastructure/composable/useActivityFeed.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { useConnection } from '@/modules/connections/infrastructure/composable/useConnection.ts'
import { useProviderConnect } from '@/modules/connections/infrastructure/composable/useProviderConnect.ts'
import type { ProgressResponse } from '@/modules/progress/infrastructure/dto/ProgressResponse.ts'
import { clearRunDayCache } from '@/modules/run-day/infrastructure/composable/useRunDay.ts'
import { resetResource, useResource } from '@/modules/shared/infrastructure/cache/useResource.ts'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'
import { queuePendingToast, type PendingToast } from '@/modules/shared/ui/pendingToast.ts'
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'
import type { PlanWeekResponse } from '@/modules/training/infrastructure/dto/PlanWeekResponse.ts'

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const { show: showToast } = useToast()
const { fetchUser, clearUser } = useCurrentUser()
const { logout } = useLogout()
const { user: sessionUser, emailVerified } = useAuth()
const { currentUser, fullName } = useUserIdentity()
const { connected: stravaConnected, activeProvider, checkStatus } = useConnection()
const { data: weekData } = useResource<PlanWeekResponse>('plan.week', () => api.plan.week())
const { data: progressData } = useResource<ProgressResponse>('progress.summary', () =>
  api.progress.summary(),
)
const weekMeta = computed(() => weekData.value?.weekMeta ?? null)
const runCount = computed(() => progressData.value?.totalActivities ?? 0)
const providerLabel = computed(() => {
  const p = activeProvider.value
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : t('settings.strava.title')
})
const memberSince = computed(() => {
  const created = currentUser.value?.createdAt
  if (created) {
    const d = new Date(created)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale.value, { month: 'short', year: 'numeric' })
    }
  }
  // Older sessions do not carry createdAt; the ObjectId prefix is the creation time.
  const id = currentUser.value?.id
  if (!id || id.length < 8) return '—'
  const ms = parseInt(id.slice(0, 8), 16) * 1000
  return Number.isNaN(ms)
    ? '—'
    : new Date(ms).toLocaleDateString(locale.value, { month: 'short', year: 'numeric' })
})
const { status: connectStatus, connect } = useProviderConnect()
// The browser's own zone; the server keeps planning in its zone for now.
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '—'
const confirming = ref(false)
const resendingVerification = ref(false)
const verificationSent = ref(false)
const erasing = ref(false)
const disconnecting = ref(false)
const syncing = ref(false)
const error = ref('')
const {
  preferences,
  saving: savingPreferences,
  load: loadPreferences,
  save: savePreferences,
} = useCoachingPreferences()
const pushBusy = ref(false)

const coachingRows = computed(() => [
  {
    key: 'explanations' as const,
    title: t('settings.coaching.explanations'),
    desc: t('settings.coaching.explanationsDesc'),
  },
  {
    key: 'sessionReminder' as const,
    title: t('settings.coaching.reminder'),
    desc: t('settings.coaching.reminderDesc'),
  },
  {
    key: 'weeklySummary' as const,
    title: t('settings.coaching.summary'),
    desc: t('settings.coaching.summaryDesc'),
  },
])

async function syncNow() {
  if (syncing.value) return
  syncing.value = true
  try {
    await api.providers.sync(activeProvider.value || 'strava')
    await checkStatus(true)
    showToast(t('strava.sync.connected'), { type: ToastType.Success })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    showToast(
      status === 401
        ? t('settings.strava.reconnectRequired')
        : apiErrorMessage(e, t('auth.error.generic')),
      { type: ToastType.Error },
    )
  } finally {
    syncing.value = false
  }
}

function coachingValue(key: 'explanations' | 'sessionReminder' | 'weeklySummary'): boolean {
  return preferences.value?.[key] ?? false
}

async function toggleCoaching(key: 'explanations' | 'sessionReminder' | 'weeklySummary') {
  if (!preferences.value || pushBusy.value || savingPreferences.value) return
  const next = !coachingValue(key)
  try {
    if (key === 'sessionReminder') {
      pushBusy.value = true
      if (next) await enablePush()
      await savePreferences({ sessionReminder: next, locale: locale.value as 'en' | 'pt' })
      if (!next) await disablePush()
    } else {
      await savePreferences({ [key]: next, locale: locale.value as 'en' | 'pt' })
    }
    showToast(t('settings.coaching.saved'), { type: ToastType.Success })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'denied') {
      showToast(t('settings.coaching.pushDenied'), { type: ToastType.Error })
    } else if (code === 'unsupported') {
      showToast(t('settings.coaching.pushUnsupported'), { type: ToastType.Error })
    } else if (code === 'unavailable') {
      showToast(t('settings.coaching.pushUnavailable'), { type: ToastType.Error })
    } else {
      showToast(apiErrorMessage(error, t('settings.coaching.saveFailed')), {
        type: ToastType.Error,
      })
    }
  } finally {
    pushBusy.value = false
  }
}

onMounted(async () => {
  await fetchUser()
  await loadPreferences().catch(() => undefined)
  try {
    await checkStatus()
  } catch {
    // The status read is best-effort; the card falls back to "connect".
  }
  if (route.query.delete === '1') await openDeleteFromMenu()
})

watch(
  () => route.query.delete,
  async (value) => {
    if (value === '1') await openDeleteFromMenu()
  },
)

async function openDeleteFromMenu(): Promise<void> {
  confirming.value = true
  await nextTick()
  document.getElementById('delete-account')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  void router.replace({ path: '/settings' })
}

function openConnect(): void {
  connect('/settings')
}

async function resendVerification(): Promise<void> {
  if (resendingVerification.value) return
  resendingVerification.value = true
  verificationSent.value = false
  try {
    await api.auth.resendVerification()
    verificationSent.value = true
  } catch (e) {
    showToast(apiErrorMessage(e, t('settings.email.sendFailed')), { type: ToastType.Error })
  } finally {
    resendingVerification.value = false
  }
}

watch(connectStatus, (next) => {
  if (next !== 'connected') return
  // Same handoff as disconnect: park the outcome, reload, and let App.vue announce it.
  queuePendingToast({ type: ToastType.Success, message: t('strava.sync.connected') })
  window.location.reload()
})

async function disconnectStrava() {
  if (disconnecting.value) return
  disconnecting.value = true
  let outcome: PendingToast
  try {
    await api.providers.disconnect(activeProvider.value)
    // The account session survives a disconnect: only the data source is gone.
    outcome = { type: ToastType.Success, message: t('settings.strava.disconnected') }
  } catch (e) {
    outcome = {
      type: ToastType.Error,
      message: apiErrorMessage(e, t('settings.strava.disconnectFailed')),
    }
  }
  disconnecting.value = false
  // Park the outcome, then reload: every view must re-read the account with no
  // provider attached, and an in-memory toast would not survive it.
  queuePendingToast(outcome)
  window.location.reload()
}

async function erase() {
  erasing.value = true
  error.value = ''
  try {
    await api.account.delete()
    forgetActivityReadWatermark(sessionUser.value?.id)
    clearUser()
    clearRunDayCache()
    // Hard clear: the reads on screen belong to an account that no longer exists,
    // and nothing may survive for the next one on this browser.
    resetResource()
    showToast(t('settings.delete.erased'), { type: ToastType.Success })
    router.replace('/login')
  } catch (e) {
    error.value = apiErrorMessage(e, t('settings.delete.eraseFail'))
  } finally {
    erasing.value = false
  }
}
</script>
