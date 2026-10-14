<template>
  <!-- Final invitation -->
  <section id="start" class="border-y border-white/10 bg-card scroll-mt-20">
    <div class="mx-auto flex max-w-shell flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-20 lg:py-[72px]">
      <div class="flex max-w-[840px] flex-col gap-5">
        <p class="text-label font-bold text-primary">{{ $t('cta.label') }}</p>
        <h2 class="text-5xl font-extrabold leading-display lg:text-[62px]">{{ $t('cta.titleA') }}<br />{{ $t('cta.titleB') }}</h2>
        <p class="text-muted">{{ $t('cta.sub') }}</p>
      </div>
      <div class="flex w-full max-w-[440px] flex-col items-center gap-3.5 lg:items-end">
        <template v-if="isFull">
          <WaitlistForm :used="slotUsed" :limit="slotLimit" input-id="footer-waitlist" />
        </template>
        <template v-else>
          <a href="/api/strava/authorize" class="flex items-center gap-3 rounded-lg bg-strava px-5.5 py-4 text-sm font-bold transition hover:brightness-110">
            <StravaIcon cls="h-[25px] w-[25px] text-white" />
            {{ $t('nav.continueStrava') }}</a>
          <p class="text-[11px] text-faint">{{ $t('cta.note') }}</p>
        </template>
        <p v-if="capacityLoaded" class="text-[11px] text-muted">
          {{ $t('hero.spots', { used: slotUsed, limit: slotLimit }) }}</p>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer id="privacy" class="mx-auto flex max-w-shell scroll-mt-20 flex-col gap-8 px-6 py-9 lg:px-20">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <RouterLink to="/" class="flex items-center gap-2.5">
        <BrandLogo />
      </RouterLink>
      <nav class="flex items-center gap-7 text-body text-muted" aria-label="Footer">
        <a href="#app" class="transition hover:text-white">{{ $t('nav.app') }}</a>
        <a href="#how" class="transition hover:text-white">{{ $t('nav.how') }}</a>
        <a href="/login" class="transition hover:text-white">{{ $t('nav.login') }}</a>
      </nav>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <p class="text-xs font-bold text-muted">{{ $t('cta.tagline') }}</p>
        <a
          href="https://buymeacoffee.com/anvictor"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 self-start rounded-lg border border-primary/40 px-4 py-2 text-label font-bold text-primary transition hover:bg-primary/10"
        >
          <CoffeeIcon cls="h-4 w-4" />
          {{ $t('cta.coffee') }}</a>
      </div>
    </div>
    <div class="h-px bg-white/10"></div>
    <div class="flex items-start justify-between text-label text-faint">
      <p>{{ $t('cta.rights') }}</p>
      <div class="flex items-start gap-6">
        <button @click="legal = 'privacy'" class="transition hover:text-white">{{ $t('cta.privacy') }}</button>
        <button @click="legal = 'terms'" class="transition hover:text-white">{{ $t('cta.terms') }}</button>
      </div>
    </div>
  </footer>
  <LegalModal :show="legal !== null" :doc="legal || 'privacy'" @close="legal = null" />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import BoltIcon from '@/components/icons/BoltIcon.vue'
import StravaIcon from '@/components/icons/StravaIcon.vue'
import CoffeeIcon from '@/components/icons/CoffeeIcon.vue'
import LegalModal from '@/components/ui/LegalModal.vue'
import WaitlistForm from '@/components/landing/WaitlistForm.vue'
import { useCapacity } from '@/composables/useCapacity.js'

const legal = ref(null)
const { full: isFull, used: slotUsed, limit: slotLimit, loaded: capacityLoaded, checkCapacity } = useCapacity()

onMounted(() => {
  checkCapacity()
})
</script>
