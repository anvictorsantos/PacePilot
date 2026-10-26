<template>
  <AuthShell
    :kicker="$t('auth.verify.kicker')"
    :title="title"
    :desc="desc"
  >
    <div
      v-if="state === 'verifying'"
      class="flex items-center gap-3 rounded-card border border-border bg-card p-5 text-body text-muted"
      role="status"
    >
      <span
        class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden="true"
      ></span>
      {{ $t('auth.verify.verifying') }}
    </div>

    <div
      v-else-if="state === 'verified'"
      class="flex flex-col gap-4 rounded-card border border-success/30 bg-success/10 p-5"
    >
      <p class="font-bold text-lead text-white">{{ $t('auth.verify.successTitle') }}</p>
      <p class="text-body text-muted leading-body">{{ $t('auth.verify.successDesc') }}</p>
      <RouterLink
        :to="authenticated ? '/workout' : '/login'"
        class="inline-flex justify-center items-center bg-primary hover:brightness-110 px-5.5 py-3.5 rounded-lg min-h-touch font-bold text-sm text-background transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        {{ authenticated ? $t('auth.verify.continueApp') : $t('auth.account.backToLogin') }}
      </RouterLink>
    </div>

    <div
      v-else
      class="flex flex-col gap-4 rounded-card border border-danger/30 bg-danger/10 p-5"
    >
      <p
        role="alert"
        class="text-body text-dangerBright"
      >
        {{ state === 'missing' ? $t('auth.verify.missingToken') : $t('auth.verify.errorDesc') }}
      </p>
      <template v-if="authenticated">
        <button
          type="button"
          class="cursor-pointer flex justify-center items-center bg-cardSecondary hover:bg-track disabled:opacity-60 px-5 py-3 border border-border rounded-lg min-h-touch font-semibold text-sm text-white transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
          :disabled="resending"
          :aria-busy="resending"
          @click="resend"
        >
          {{ resending ? $t('auth.verify.resending') : $t('auth.verify.resend') }}
        </button>
        <p
          v-if="resent"
          role="status"
          class="text-success text-xs"
        >
          {{ $t('auth.verify.resent') }}
        </p>
      </template>
      <RouterLink
        v-else
        to="/login"
        class="font-semibold text-primaryBright hover:text-primaryBright text-sm underline transition"
      >
        {{ $t('auth.verify.signInToResend') }}
      </RouterLink>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import AuthShell from '@/features/auth/components/AuthShell.vue'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

type VerifyState = 'verifying' | 'verified' | 'error' | 'missing'

const route = useRoute()
const { t } = useI18n()
const { authenticated, ensure } = useAuth()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const state = ref<VerifyState>(token.value ? 'verifying' : 'missing')
const resending = ref(false)
const resent = ref(false)

const title = computed(() =>
  state.value === 'verified' ? t('auth.verify.successTitle') : t('auth.verify.title'),
)
const desc = computed(() => {
  if (state.value === 'verified') return ''
  if (state.value === 'missing') return ''
  return t('auth.verify.desc')
})

async function verify(): Promise<void> {
  if (!token.value) {
    state.value = 'missing'
    return
  }
  try {
    await api.auth.verifyEmail(token.value)
    state.value = 'verified'
    void ensure(true)
  } catch {
    state.value = 'error'
  }
}

async function resend(): Promise<void> {
  if (resending.value) return
  resending.value = true
  resent.value = false
  try {
    if (!(await ensure())) return
    await api.auth.resendVerification()
    resent.value = true
  } catch {
    // The generic error block stays; the athlete can try again.
  } finally {
    resending.value = false
  }
}

onMounted(verify)
</script>
