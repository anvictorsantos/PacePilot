<template>
  <!-- Final invitation -->
  <section class="border-y border-white/10 bg-card">
    <div class="mx-auto flex max-w-shell flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-20 lg:py-[72px]">
      <div class="flex max-w-[840px] flex-col gap-5">
        <p class="text-label font-bold text-primary">YOUR NEXT RUN STARTS HERE</p>
        <h2 class="text-5xl font-extrabold leading-display lg:text-[62px]">Less wondering.<br />More running.</h2>
        <p class="text-muted">Bring a little more direction to your training.</p>
      </div>
      <div class="flex flex-col items-center gap-3.5">
        <a href="/api/strava/authorize" class="flex items-center gap-3 rounded-lg bg-strava px-5.5 py-4 text-sm font-bold transition hover:brightness-110">
          <StravaIcon cls="h-[25px] w-[25px] text-white" />
          Continue with Strava
        </a>
        <p class="text-label text-faint">Sign in with your Strava account</p>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer id="privacy" class="mx-auto flex max-w-shell scroll-mt-20 flex-col gap-8 px-6 py-9 lg:px-20">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <a href="#top" class="flex items-center gap-2.5">
        <span class="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-primary/10">
          <BoltIcon cls="h-[20px] w-[18px] text-primary" />
        </span>
        <span class="text-title font-extrabold tracking-tight">PacePilot</span>
      </a>
      <nav class="flex items-center gap-7 text-body text-muted" aria-label="Footer">
        <a href="#app" class="transition hover:text-white">The app</a>
        <a href="#how" class="transition hover:text-white">How it works</a>
        <a href="/login" class="transition hover:text-white">Log in</a>
      </nav>
      <p class="text-xs font-bold text-muted">EVERY RUN. A REASON.</p>
    </div>
    <div class="h-px bg-white/10"></div>
    <div class="flex items-start justify-between text-label text-faint">
      <p>© 2026 PacePilot</p>
      <div class="flex items-start gap-6">
        <button @click="legal = 'privacy'" class="transition hover:text-white">Privacy</button>
        <button @click="legal = 'terms'" class="transition hover:text-white">Terms</button>
      </div>
    </div>
  </footer>
  <LegalModal :show="legal !== null" :doc="legal || 'privacy'" @close="legal = null" />
</template>

<script setup>
import { ref } from 'vue'
import BoltIcon from '@/components/icons/BoltIcon.vue'
import StravaIcon from '@/components/icons/StravaIcon.vue'
import LegalModal from '@/components/ui/LegalModal.vue'

const legal = ref(null)
</script>
