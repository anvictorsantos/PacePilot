<template>
  <AuthShell
    :kicker="$t('auth.reset.kicker')"
    :title="$t('auth.reset.title')"
    :desc="$t('auth.reset.desc')"
  >
    <div
      v-if="done"
      class="flex flex-col gap-4 rounded-card border border-success/30 bg-success/10 p-5"
    >
      <p class="font-bold text-lead text-white">{{ $t('auth.reset.successTitle') }}</p>
      <p class="text-body text-muted leading-body">{{ $t('auth.reset.successDesc') }}</p>
      <RouterLink
        to="/login"
        class="font-semibold text-primaryBright hover:text-primary text-sm underline transition"
      >
        {{ $t('auth.account.backToLogin') }}
      </RouterLink>
    </div>

    <p
      v-else-if="!token"
      role="alert"
      class="bg-danger/10 p-4 border border-danger/30 rounded-lg text-danger text-body"
    >
      {{ $t('auth.reset.missingToken') }}
    </p>

    <form
      v-else
      class="flex flex-col gap-4"
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-1.5">
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- control is the sibling input with the matching id -->
        <label
          for="reset-password"
          class="font-medium text-label text-ink"
        >
          {{ $t('auth.reset.newPassword') }}
        </label>
        <PasswordInput
          id="reset-password"
          v-model="password"
          name="password"
          autocomplete="new-password"
          required
          :minlength="8"
          :maxlength="128"
          :placeholder="$t('auth.form.passwordPlaceholder')"
          :disabled="submitting"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- control is the sibling input with the matching id -->
        <label
          for="reset-password-confirm"
          class="font-medium text-label text-ink"
        >
          {{ $t('auth.reset.confirmPassword') }}
        </label>
        <PasswordInput
          id="reset-password-confirm"
          v-model="confirmation"
          name="password-confirmation"
          autocomplete="new-password"
          required
          :minlength="8"
          :maxlength="128"
          :placeholder="$t('auth.reset.confirmPlaceholder')"
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
        {{ submitting ? $t('auth.reset.submitting') : $t('auth.reset.submit') }}
      </button>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import AuthShell from '@/features/auth/components/AuthShell.vue'
import PasswordInput from '@/features/auth/components/PasswordInput.vue'
import { useAuth } from '@/modules/auth/infrastructure/composable/useAuth.ts'
import { api } from '@/modules/shared/infrastructure/http/client.ts'

const route = useRoute()
const { t } = useI18n()
const { clear } = useAuth()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const confirmation = ref('')
const submitting = ref(false)
const done = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''
  if (password.value.length < 8) {
    error.value = t('auth.error.invalidInput')
    return
  }
  if (password.value !== confirmation.value) {
    error.value = t('auth.reset.mismatch')
    return
  }

  submitting.value = true
  try {
    await api.auth.resetPassword(token.value, password.value)
    clear()
    done.value = true
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status === 400) error.value = t('auth.reset.invalidToken')
    else if (status === 429) error.value = t('auth.error.tooManyAttempts')
    else if (status === 503) error.value = t('auth.error.unavailable')
    else error.value = t('auth.error.generic')
  } finally {
    submitting.value = false
  }
}
</script>
