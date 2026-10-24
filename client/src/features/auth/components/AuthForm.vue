<template>
  <form
    class="flex flex-col gap-4"
    @submit.prevent="onSubmit"
  >
    <div class="flex flex-col gap-1.5">
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- control is the sibling input with the matching id -->
      <label
        for="auth-email"
        class="font-medium text-label text-ink"
      >
        {{ $t('auth.form.email') }}
      </label>
      <input
        id="auth-email"
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
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? 'auth-form-error' : undefined"
        :disabled="submitting"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- control is the sibling input with the matching id -->
      <label
        for="auth-password"
        class="font-medium text-label text-ink"
      >
        {{ $t('auth.form.password') }}
      </label>
      <PasswordInput
        id="auth-password"
        v-model="password"
        name="password"
        :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
        required
        :minlength="8"
        :maxlength="128"
        :placeholder="$t('auth.form.passwordPlaceholder')"
        :invalid="Boolean(error)"
        :describedby="
          error ? 'auth-form-error' : mode === 'register' ? 'auth-password-hint' : undefined
        "
        :disabled="submitting"
      />
      <p
        v-if="mode === 'register'"
        id="auth-password-hint"
        class="text-caption text-muted"
      >
        {{ $t('auth.form.passwordHint') }}
      </p>
    </div>

    <p
      v-if="error"
      id="auth-form-error"
      role="alert"
      class="bg-danger/10 p-3 border border-danger/30 rounded-lg text-danger text-xs"
    >
      {{ error }}
    </p>

    <button
      type="submit"
      class="flex justify-center items-center bg-primary hover:brightness-110 disabled:opacity-60 px-5.5 py-4 rounded-lg min-h-touch font-bold text-sm text-white transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      :disabled="submitting"
      :aria-busy="submitting"
    >
      {{
        submitting
          ? $t('auth.form.submitting')
          : mode === 'register'
            ? $t('auth.form.register')
            : $t('auth.form.login')
      }}
    </button>

    <p class="text-muted text-xs text-center">
      {{ mode === 'register' ? $t('auth.form.haveAccount') : $t('auth.form.noAccount') }}
      <button
        type="button"
        class="font-semibold text-primaryBright hover:text-primary underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        @click="$emit('update:mode', mode === 'register' ? 'login' : 'register')"
      >
        {{ mode === 'register' ? $t('auth.form.switchLogin') : $t('auth.form.switchRegister') }}
      </button>
    </p>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import PasswordInput from '@/features/auth/components/PasswordInput.vue'

type AuthMode = 'login' | 'register'

defineProps<{
  mode: AuthMode
  submitting: boolean
  error: string
}>()

const emit = defineEmits<{
  submit: [payload: { email: string; password: string }]
  'update:mode': [mode: AuthMode]
}>()

const email = ref('')
const password = ref('')

function onSubmit(): void {
  if (email.value.trim() === '' || password.value === '') return
  emit('submit', { email: email.value.trim(), password: password.value })
}
</script>
