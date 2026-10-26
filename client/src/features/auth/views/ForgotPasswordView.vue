<template>
  <AuthShell
    :kicker="$t('auth.forgot.kicker')"
    :title="$t('auth.forgot.title')"
    :desc="$t('auth.forgot.desc')"
  >
    <div
      v-if="sent"
      class="flex flex-col gap-4 bg-success/10 p-5 border border-success/30 rounded-card"
    >
      <p class="font-bold text-lead text-white">{{ $t('auth.forgot.sentTitle') }}</p>
      <p class="text-body text-muted leading-body">
        {{ $t('auth.forgot.sentDesc') }}
      </p>
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
          class="font-medium text-ink text-label"
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
          class="bg-cardSecondary px-4 py-3 border border-border rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-full min-h-touch text-body text-white placeholder:text-faint"
          :placeholder="$t('auth.form.emailPlaceholder')"
          :disabled="submitting"
        />
      </div>

      <p
        v-if="error"
        role="alert"
        class="bg-danger/10 p-3 border border-danger/30 rounded-lg text-dangerBright text-xs"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        class="flex justify-center items-center bg-primary disabled:opacity-60 hover:brightness-110 px-5.5 py-4 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-touch font-bold text-background text-sm transition cursor-pointer disabled:cursor-not-allowed"
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
