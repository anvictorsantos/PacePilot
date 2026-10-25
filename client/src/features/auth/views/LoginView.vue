<template>
  <div class="flex min-h-screen">
    <!-- Editorial panel (desktop) — gradient, no stock photography -->
    <aside
      class="hidden isolation-isolate relative lg:flex flex-col justify-between lg:self-stretch p-12 w-1/2 lg:min-h-[1024px] overflow-hidden shrink-0"
      aria-hidden="true"
    >
      <img
        src="/login-editorial.jpg"
        alt=""
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="z-0 absolute inset-0 bg-editorial-scrim"></div>
      <a
        href="/"
        class="z-10 relative flex items-start w-[147px] h-[34px]"
        aria-label="PacePilot"
      >
        <BrandLogo />
      </a>
      <div
        class="z-20 relative flex flex-col flex-none items-start self-stretch gap-5.5 w-[584px] h-[285px]"
      >
        <p class="flex-none font-bold text-label text-primary leading-label">
          {{ $t('common.brandTagline') }}
        </p>
        <p
          class="flex-none self-stretch w-[584px] font-black text-[58px] text-white leading-[106%]"
        >
          {{ $t('auth.heroTitleLine1') }}<br /><span class="text-primary">{{
            $t('auth.heroTitleLine2')
          }}</span>
        </p>
        <p class="flex-none w-[480px] text-ink text-base leading-body">
          {{ $t('auth.heroDesc') }}
        </p>
        <div
          class="flex flex-row flex-none items-start self-stretch gap-6.5 pt-5 border-white/10 border-t w-[584px] h-[32px] font-bold text-caption text-muted leading-3"
        >
          <span class="flex-none w-[36px]">{{ $t('ui.today') }}</span
          ><span class="flex-none w-[28px]">{{ $t('ui.plan') }}</span
          ><span class="flex-none w-[55px]">{{ $t('ui.progress') }}</span
          ><span class="flex-none w-[35px]">{{ $t('ui.goals') }}</span>
        </div>
      </div>
    </aside>

    <!-- Auth column -->
    <main
      class="flex flex-col flex-1 justify-between items-center px-6 sm:px-12 lg:px-[72px] py-8 lg:py-12"
    >
      <div class="flex justify-between items-center self-stretch w-full max-w-[616px]">
        <RouterLink
          to="/"
          class="flex items-center gap-2 text-muted hover:text-white text-xs transition"
        >
          <ArrowLeftIcon cls="h-4 w-4" />
          {{ $t('auth.back') }}</RouterLink
        >
        <LanguageSwitcher />
      </div>

      <div class="flex flex-col gap-8 w-full max-w-[440px]">
        <div class="flex flex-col gap-5">
          <p class="font-bold text-label text-primary">
            {{ $t('auth.form.kicker') }}
          </p>
          <h1 class="font-extrabold text-5xl leading-display">
            {{ mode === 'register' ? $t('auth.form.registerTitle') : $t('auth.form.title') }}
          </h1>
          <p class="text-lead text-muted leading-loose">
            {{ mode === 'register' ? $t('auth.form.registerDesc') : $t('auth.form.desc') }}
          </p>
        </div>

        <div class="flex flex-col gap-4">
          <AuthForm
            :mode="mode"
            :submitting="submitting"
            :error="error"
            @submit="submit"
            @update:mode="onModeChange"
          />
          <div
            v-if="mode === 'login'"
            class="-mt-1 flex justify-end"
          >
            <RouterLink
              to="/forgot-password"
              class="text-muted hover:text-white text-xs underline underline-offset-2 transition"
            >
              {{ $t('auth.form.forgot') }}
            </RouterLink>
          </div>
          <p
            v-if="oauthError"
            role="alert"
            class="bg-danger/10 p-3 border border-danger/30 rounded-lg text-danger text-xs text-center"
          >
            {{ oauthError }}
          </p>
        </div>

        <div class="bg-card p-5 border border-white/10 rounded-lg">
          <p class="font-bold text-label">{{ $t('auth.next.title') }}</p>
          <p class="mt-3 text-body text-muted leading-body">
            {{ $t('auth.next.desc') }}
          </p>
        </div>

        <p class="text-faint text-label leading-[170%]">
          {{ $t('auth.consent.termsPrefix') }}
          <button
            class="cursor-pointer hover:text-white underline transition"
            @click="legal = 'terms'"
          >
            {{ $t('legal.terms.title') }}
          </button>
          {{ $t('auth.consent.privacyPrefix') }}
          <button
            class="cursor-pointer hover:text-white underline transition"
            @click="legal = 'privacy'"
          >
            {{ $t('legal.privacy.title') }}</button
          >.
        </p>
      </div>

      <div
        class="flex justify-between items-start self-stretch mt-5 w-full max-w-[616px] text-faint text-label"
      >
        <p>{{ $t('common.rights') }}</p>
        <div class="flex items-start gap-5">
          <button
            class="cursor-pointer hover:text-white transition"
            @click="legal = 'privacy'"
          >
            {{ $t('ui.privacy') }}
          </button>
          <button
            class="cursor-pointer hover:text-white transition"
            @click="legal = 'terms'"
          >
            {{ $t('ui.terms') }}
          </button>
        </div>
      </div>
      <LegalModal
        :show="legal !== null"
        :doc="legal || 'privacy'"
        @close="legal = null"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import LegalModal from '@/components/ui/LegalModal.vue'
import AuthForm from '@/features/auth/components/AuthForm.vue'
import { useAnalytics } from '@/modules/analytics/infrastructure/composable/useAnalytics.ts'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { trackSignup } = useAnalytics()
const { ensure, login, register } = useAuth()

const mode = ref<'login' | 'register'>(route.query.mode === 'register' ? 'register' : 'login')
const submitting = ref(false)
const error = ref('')
const legal = ref<'privacy' | 'terms' | null>(null)

/** A same-origin path survives the login hop; anything else goes to the app. */
const next = computed(() => {
  const value = route.query.next
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/workout'
})

const oauthError = computed(() => {
  if (route.query.error === 'connect_requires_login') return t('auth.error.connectFirst')
  if (route.query.error === 'oauth_failed') return t('auth.error.connectionFailed')
  return ''
})

function onModeChange(value: 'login' | 'register'): void {
  mode.value = value
  error.value = ''
}

function errorMessage(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status
  if (status === 401) return t('auth.error.invalidCredentials')
  if (status === 409) return t('auth.error.emailTaken')
  if (status === 400) return t('auth.error.invalidInput')
  if (status === 429) return t('auth.error.tooManyAttempts')
  if (status === 503) return t('auth.error.unavailable')
  return apiErrorMessage(e, t('auth.error.generic'))
}

async function submit(credentials: { email: string; password: string }): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    const session =
      mode.value === 'register'
        ? await register(credentials.email, credentials.password)
        : await login(credentials.email, credentials.password)
    if (mode.value === 'register') trackSignup()
    // First login after signup: ask for Strava once, inside the app.
    const linked =
      (session.connections ?? []).some((entry) => entry.connected) || session.strava.connected
    if (!linked && !session.strava.promptSeen) {
      await router.replace({ path: '/connect', query: { next: next.value } })
      return
    }
    await router.replace(next.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  // A live session never sits on the login screen.
  if (!(await ensure())) return
  const session = useAuth()
  if (!session.anyConnected.value && !session.strava.value.promptSeen) {
    await router.replace({ path: '/connect', query: { next: next.value } })
    return
  }
  await router.replace(next.value)
})
</script>
