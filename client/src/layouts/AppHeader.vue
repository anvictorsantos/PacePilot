<template>
  <header class="flex items-center justify-between bg-background px-6 py-4 border-white/10 border-b">
    <div class="flex items-center gap-3">
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 shrink-0"
      >
        <BrandLogo />
      </RouterLink>
    </div>
    <div class="flex items-center gap-3">
      <LanguageSwitcher />
      <NotificationCenter
        v-if="statusLoaded"
        :last-synced-at="lastSyncedAt"
      />

      <!-- profile dropdown (Tailwind Plus — Elements / Dropdowns / User menu) -->
      <AppDropdown panel-class="right-0 w-56">
        <template #trigger="{ open, toggle }">
          <button
            type="button"
            class="flex items-center gap-2 hover:bg-white/5 -mr-1 py-1 pr-2 pl-1 min-h-touch rounded-full transition"
            :aria-label="$t('shell.userMenu')"
            aria-haspopup="menu"
            :aria-expanded="open"
            @click="toggle"
          >
            <div
              v-if="currentUser?.profile && !photoFailed"
              class="relative"
            >
              <img
                :src="currentUser.profile"
                :alt="fullName"
                class="border border-white/10 rounded-full w-8 h-8 object-cover"
                referrerpolicy="no-referrer"
                @error="photoFailed = true"
              />
              <span
                v-if="stravaConnected"
                class="-top-0.5 -right-0.5 absolute flex w-2.5 h-2.5"
              >
                <span
                  class="inline-flex absolute bg-success opacity-75 rounded-full w-full h-full animate-ping"
                ></span>
                <span
                  class="inline-flex relative bg-success rounded-full ring-2 ring-background w-2.5 h-2.5"
                ></span>
              </span>
            </div>
            <div
              v-else
              class="relative"
            >
              <div
                class="flex justify-center items-center bg-primary rounded-full w-8 h-8 font-bold text-white text-sm"
              >
                {{ initials }}
              </div>
              <span
                v-if="stravaConnected"
                class="-top-0.5 -right-0.5 absolute flex w-2.5 h-2.5"
              >
                <span
                  class="inline-flex absolute bg-success opacity-75 rounded-full w-full h-full animate-ping"
                ></span>
                <span
                  class="inline-flex relative bg-success rounded-full ring-2 ring-background w-2.5 h-2.5"
                ></span>
              </span>
            </div>
            <span class="hidden sm:block max-w-[10rem] font-medium text-white text-sm truncate">{{
              fullName
            }}</span>
            <ChevronDownIcon cls="w-4 h-4 text-muted shrink-0 hidden sm:block" />
          </button>
        </template>

        <template #default="{ close }">
          <!-- user header -->
          <div class="px-4 py-3 border-white/10 border-b">
            <div class="font-semibold text-white text-sm truncate">
              {{ fullName }}
            </div>
            <div class="text-muted text-xs truncate">
              {{ currentUser?.email || $t('shell.athlete') }}
            </div>
          </div>

          <!-- primary links -->
          <RouterLink
            to="/strava"
            class="flex items-center gap-3 hover:bg-white/5 px-4 py-2 text-white text-sm transition"
            role="menuitem"
            @click="close()"
          >
            <LinkIcon cls="w-5 h-5 text-muted" />
            {{ $t('shell.strava') }}
            <span
              class="ml-auto rounded-full w-2 h-2"
              :class="stravaConnected ? 'bg-success' : 'bg-white/25'"
            ></span>
          </RouterLink>

          <RouterLink
            to="/"
            class="flex items-center gap-3 hover:bg-white/5 px-4 py-2 text-white text-sm transition"
            role="menuitem"
            @click="close()"
          >
            <HomeIcon cls="w-5 h-5 text-muted" />
            {{ $t('landing.back') }}
          </RouterLink>

          <!-- settings at the bottom (Plus: divided section) -->
          <div class="mt-1 pt-1 border-white/10 border-t">
            <RouterLink
              to="/settings"
              class="flex items-center gap-3 hover:bg-white/5 px-4 py-2 text-white text-sm transition"
              role="menuitem"
              @click="close()"
            >
              <Cog6ToothIcon cls="w-5 h-5 text-muted" />
              {{ $t('shell.settings') }}
            </RouterLink>
          </div>
        </template>
      </AppDropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ChevronDownIcon from '@/components/icons/ChevronDownIcon.vue'
import Cog6ToothIcon from '@/components/icons/Cog6ToothIcon.vue'
import HomeIcon from '@/components/icons/HomeIcon.vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import AppDropdown from '@/components/ui/AppDropdown.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import { useCurrentUser } from '@/composables/useCurrentUser.ts'
import NotificationCenter from '@/layouts/NotificationCenter.vue'
import { recordRecoveredError } from '@/services/logger.ts'
import { getStravaStatus } from '@/services/strava.ts'

const stravaConnected = ref(false)
const { t } = useI18n()
const lastSyncedAt = ref(null)
const statusLoaded = ref(false)
const photoFailed = ref(false)
const { user: currentUser, fetchUser } = useCurrentUser()

// Retry avatar when profile URL changes (e.g. re-login with fresh photo).
watch(
  () => currentUser.value?.profile,
  () => {
    photoFailed.value = false
  },
)

const fullName = computed(() => {
  const f = currentUser.value?.firstname || ''
  const l = currentUser.value?.lastname || ''
  const n = `${f} ${l}`.trim()
  return n || t('shell.athlete')
})
const initials = computed(() => {
  const f = currentUser.value?.firstname?.[0] || ''
  const l = currentUser.value?.lastname?.[0] || ''
  return (f + l).toUpperCase() || 'A'
})

onMounted(async () => {
  fetchUser()
  try {
    const data = await getStravaStatus()
    stravaConnected.value = data.connected
    lastSyncedAt.value = data.last_synced_at || null
  } catch (error) { recordRecoveredError(error) }
  statusLoaded.value = true
})
</script>
