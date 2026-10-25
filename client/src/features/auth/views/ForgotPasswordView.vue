<template>
  <AuthShell
    :kicker="$t('auth.forgot.kicker')"
    :title="$t('auth.forgot.title')"
    :desc="$t('auth.forgot.desc')"
  >
    <div
      v-if="sent"
      class="flex flex-col gap-4 rounded-card border border-success/30 bg-success/10 p-5"
    >
      <p class="font-bold text-lead text-white">{{ $t('auth.forgot.sentTitle') }}</p>
      <p class="text-body text-muted leading-body">
        {{ $t('auth.forgot.sentDesc') }}
      </p>
      <RouterLink
        to="/login"
        class="font-semibold text-primaryBright hover:text-primary text-sm underline transition"
      >
        {{ $t('auth.account.backToLogin') }}
      </RouterLink>
    </div>

    <form
      v-else
      class="flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-1.5">
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- control is the sibling input with the matching id -->
        <label
          for="forgot-email"
          class="font-medium text-label text-ink"
        >
          {{ $t('auth.form.email') }}
        </label>
        <input
          id="forgot-email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          inputmode="email"
          required
          maxlength="254"
          class="bg-cardSecondary px-4 py-3 border border-border rounded-lg w-full min-h-touch text-body text-white placeholder:text-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          :placeholder="$t('auth.form.emailPlaceholder')"
          :disabled="submitting"
        />
      </div>

      <p
        v-if="error"
        role="alert"
        class="bg-danger/10 p-3 border border-danger/30 rounded-lg text-danger text-xs"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        class="cursor-pointer flex justify-center items-center bg-primary hover:brightness-110 disabled:opacity-60 px-5.5 py-4 rounded-lg min-h-touch font-bold text-sm text-white transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
        :disabled="submitting"
        :aria-busy="submitting"
      >
        {{ submitting ? $t('auth.forgot.submitting') : $t('auth.forgot.submit') }}
      </button>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthShell from '@/features/auth/components/AuthShell.vue'
import { api, apiErrorMessage } from '@/modules/shared/infrastructure/http/client.ts'

const { t } = useI18n()
const email = ref('')
const submitting = ref(false)
const sent = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  if (submitting.value || !email.value.trim()) return
  submitting.value = true
  error.value = ''
  try {
    await api.auth.forgotPassword(email.value.trim())
    sent.value = true
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 429) error.value = t('auth.error.tooManyAttempts')
    else if (status === 400) error.value = t('auth.error.invalidInput')
    else if (status === 503) error.value = t('auth.error.unavailable')
    else error.value = apiErrorMessage(e, t('auth.error.generic'))
  } finally {
    submitting.value = false
  }
}
</script>
