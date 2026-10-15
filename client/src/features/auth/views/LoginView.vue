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
          <span class="flex justify-center items-center bg-primary/10 rounded-xl w-[52px] h-[52px]">
            <LinkIcon cls="h-6 w-6 text-primary" />
          </span>
          <p class="font-bold text-label text-primary">
            {{ $t('auth.form.kicker') }}
          </p>
          <h1 class="font-extrabold text-5xl leading-display">
            {{ $t('auth.form.title') }}
          </h1>
          <p class="text-lead text-muted leading-loose">
            {{ $t('auth.form.desc') }}
          </p>
        </div>

        <div class="flex flex-col gap-4">
          <template v-if="isFull">
            <WaitlistForm
              :used="slotUsed"
              :limit="slotLimit"
              input-id="login-waitlist"
            />
          </template>
          <template v-else>
            <a
              href="/api/strava/authorize"
              class="flex justify-center items-center gap-3 bg-strava hover:brightness-110 px-5.5 py-4 rounded-lg font-bold text-sm transition"
            >
              <StravaIcon cls="h-[25px] w-[25px] text-white" />
              {{ $t('auth.connectButton') }}</a
            >
            <p class="text-muted text-xs text-center">
              {{ $t('auth.stravaOnly') }}
            </p>
          </template>
          <p
            v-if="capacityLoaded"
            class="text-muted text-xs text-center"
          >
            {{ $t('auth.spots', { used: slotUsed, limit: slotLimit }) }}
          </p>
          <p
            v-if="status === 'error'"
            class="bg-danger/10 p-3 border border-danger/30 rounded-lg text-danger text-xs text-center"
          >
            {{ isFullError ? $t('auth.error.spotsFull') : $t('auth.error.connectionFailed') }}
          </p>
          <p
            v-if="status === 'connected'"
            class="bg-success/10 p-3 border border-success/30 rounded-lg text-success text-xs text-center"
          >
            {{ $t('auth.connectedRedirect') }}
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
            class="hover:text-white underline transition"
            @click="legal = 'terms'"
          >
            {{ $t('legal.terms.title') }}
          </button>
          {{ $t('auth.consent.privacyPrefix') }}
          <button
            class="hover:text-white underline transition"
            @click="legal = 'privacy'"
          >
            {{ $t('legal.privacy.title') }}</button
          >.
        </p>
      </div>

      <div
        class="flex justify-between items-start self-stretch w-full max-w-[616px] text-faint text-label"
      >
        <p>{{ $t('common.rights') }}</p>
        <div class="flex items-start gap-5">
          <button
            class="hover:text-white transition"
            @click="legal = 'privacy'"
          >
            Privacy
          </button>
          <button
            class="hover:text-white transition"
            @click="legal = 'terms'"
          >
            Terms
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

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import StravaIcon from '@/components/icons/StravaIcon.vue'
import WaitlistForm from '@/components/shared/WaitlistForm.vue'
import BrandLogo from '@/components/ui/BrandLogo.vue'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import LegalModal from '@/components/ui/LegalModal.vue'
import { useCapacity } from '@/composables/useCapacity.js'
import { useSession } from '@/composables/useSession.js'

const route = useRoute()
const router = useRouter()
const { checkStatus, setConnected } = useSession()
const {
  full: isFull,
  used: slotUsed,
  limit: slotLimit,
  loaded: capacityLoaded,
  checkCapacity,
} = useCapacity()
const status = ref('')
const legal = ref(null)
const isFullError = computed(() => route.query.error === 'app_full')

onMounted(async () => {
  checkCapacity()
  // Already connected → straight to dashboard (or ?next= target).
  if (await checkStatus()) {
    router.replace(route.query.next || '/workout')
    return
  }
  if (route.query.error) status.value = 'error'
  if (route.query.connected) {
    // OAuth landed here — re-verify before entering (cookie set server-side).
    if (await checkStatus(true)) {
      status.value = 'connected'
      setConnected(true)
      setTimeout(() => router.replace(route.query.next || '/workout'), 600)
    } else {
      status.value = 'error'
    }
  }
})
</script>
