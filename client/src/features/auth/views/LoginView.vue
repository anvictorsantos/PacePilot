<template>
  <div class="flex flex-col bg-background min-h-screen">
    <header class="flex justify-between items-center mx-auto px-6 py-6 w-full max-w-[1240px]">
      <RouterLink
        to="/"
        class="flex items-center gap-2 text-muted hover:text-primary text-body transition"
      >
        <ArrowLeftIcon cls="h-4 w-4" />
        {{ $t('auth.back') }}</RouterLink
      >
      <LanguageSwitcher />
    </header>

    <main class="flex flex-1 justify-center px-6 pt-10 pb-20">
      <div class="w-[380px] max-w-full">
        <div class="flex justify-center mb-7">
          <BrandLogo />
        </div>
        <h1 class="mb-1.5 font-medium text-2xl text-primary text-center tracking-tight">
          {{ mode === 'register' ? $t('auth.form.registerTitle') : $t('auth.form.title') }}
        </h1>
        <p class="mb-6.5 text-body text-muted text-center">
          {{ mode === 'register' ? $t('auth.form.registerDesc') : $t('auth.form.desc') }}
        </p>

        <AuthForm
          :mode="mode"
          :submitting="submitting"
          :error="error"
          @submit="submit"
          @update:mode="onModeChange"
        />

        <div
          v-if="mode === 'login'"
          class="flex justify-center mt-4.5 text-body"
        >
          <RouterLink
            to="/forgot-password"
            class="text-muted hover:text-primary transition"
          >
            {{ $t('auth.form.forgot') }}
          </RouterLink>
        </div>

        <p
          v-if="oauthError"
          role="alert"
          class="mt-4 bg-danger/10 p-3 border border-danger/30 rounded-lg text-dangerBright text-body text-center"
        >
          {{ oauthError }}
        </p>

        <p class="mt-8 text-faint text-label leading-[170%]">
          {{ $t('auth.consent.termsPrefix') }}
          <button
            class="hover:text-primary underline transition cursor-pointer"
            @click="legal = 'terms'"
          >
            {{ $t('legal.terms.title') }}
          </button>
          {{ $t('auth.consent.privacyPrefix') }}
          <button
            class="hover:text-primary underline transition cursor-pointer"
            @click="legal = 'privacy'"
          >
            {{ $t('legal.privacy.title') }}</button
          >.
        </p>
      </div>
    </main>

    <footer class="flex justify-between items-start mx-auto px-6 py-6 w-full max-w-[1240px] text-faint text-label">
      <p>{{ $t('common.rights') }}</p>
      <div class="flex items-start gap-5">
        <button
          class="hover:text-primary transition cursor-pointer"
          @click="legal = 'privacy'"
        >
          {{ $t('ui.privacy') }}
        </button>
        <button
          class="hover:text-primary transition cursor-pointer"
          @click="legal = 'terms'"
        >
          {{ $t('ui.terms') }}
        </button>
      </div>
    </footer>
    <LegalModal
      :show="legal !== null"
      :doc="legal || 'privacy'"
      @close="legal = null"
    />
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
import { ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { trackSignup } = useAnalytics()
const { ensure, login, register } = useAuth()
const { show: showToast } = useToast()

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

function errorCode(e: unknown): string | null {
  const code = (e as { response?: { data?: { code?: unknown } } })?.response?.data?.code
  return typeof code === 'string' ? code : null
}

function errorMessage(e: unknown): string {
  if (errorCode(e) === 'email_not_allowed') return t('auth.error.emailNotAllowed')
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
    const message = errorMessage(e)
    error.value = message
    showToast(message, { type: ToastType.Error, duration: 5000 })
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
