<template>
  <div class="max-w-2xl">
    <div class="flex items-center justify-between gap-4">
      <h1 class="font-bold text-white text-2xl">{{ $t('settings.title') }}</h1>
      <LanguageSwitcher />
    </div>
    <div class="space-y-4 mt-6">
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.profile.title') }}</div>
        <div class="mt-1 text-muted text-sm">{{ $t('settings.profile.desc') }}</div>
        <div class="mt-2 text-muted text-xs">{{ $t('settings.timezone') }}: Europe/Lisbon</div>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.data.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.data.desc') }}</p>
        <p class="mt-2 text-muted text-sm">{{ $t('settings.gdpr') }}</p>
      </div>
      <div class="bg-card p-6 border border-white/10 rounded-2xl">
        <div class="font-semibold text-white text-sm">{{ $t('settings.about.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.about.desc') }}</p>
      </div>
      <div
        v-if="currentUser"
        class="bg-card p-6 border border-danger/30 rounded-2xl"
      >
        <div class="font-semibold text-white text-sm">{{ $t('settings.delete.title') }}</div>
        <p class="mt-1 text-muted text-sm">{{ $t('settings.delete.desc') }}</p>
        <button
          v-if="!confirming"
          class="bg-transparent hover:bg-danger/10 mt-4 px-4 py-2 min-h-touch border border-danger/50 rounded-xl font-semibold text-danger text-sm transition"
          @click="confirming = true"
        >
          {{ $t('settings.delete.button') }}
        </button>
        <div
          v-else
          class="flex flex-wrap items-center gap-3 mt-4"
        >
          <button
            :disabled="erasing"
            class="bg-danger disabled:opacity-50 hover:brightness-110 px-4 py-2 min-h-touch rounded-xl font-semibold text-white text-sm transition"
            @click="erase"
          >
            {{ erasing ? $t('settings.delete.erasing') : $t('settings.delete.confirm') }}
          </button>
          <button
            :disabled="erasing"
            class="bg-white/10 hover:bg-white/15 px-4 py-2 min-h-touch rounded-xl text-white text-sm transition"
            @click="confirming = false"
          >
            {{ $t('settings.delete.keep') }}
          </button>
        </div>
        <p
          v-if="error"
          class="mt-3 text-danger text-sm"
        >
          {{ error }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { useCurrentUser } from '@/composables/useCurrentUser.ts'
import { ToastType, useToast } from '@/composables/useToast.ts'
import { clearRunDayCache } from '@/run-day/useRunDay.ts'
import { api, apiErrorMessage } from '@/services/client.ts'

const router = useRouter()
const { t } = useI18n()
const { show: showToast } = useToast()
const { user: currentUser, fetchUser, clearUser } = useCurrentUser()
const confirming = ref(false)
const erasing = ref(false)
const error = ref('')

onMounted(() => {
  fetchUser()
})

async function erase() {
  erasing.value = true
  error.value = ''
  try {
    await api.account.delete()
    clearUser()
    clearRunDayCache()
    showToast(t('settings.delete.erased'), { type: ToastType.Success })
    router.replace('/strava')
  } catch (e) {
    error.value = apiErrorMessage(e, t('settings.delete.eraseFail'))
  } finally {
    erasing.value = false
  }
}
</script>
