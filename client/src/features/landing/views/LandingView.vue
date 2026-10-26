<template>
  <div id="top">
    <LandingNav />
    <main>
      <LandingHero />
      <LandingSections />
    </main>
    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import LandingHero from '@/features/landing/components/LandingHero.vue'
import LandingNav from '@/features/landing/components/LandingNav.vue'

// Only the nav and the hero are in the first viewport, and the hero heading is
// the LCP element. Sections and footer are below the fold, so they load after
// the first paint instead of holding it up.
const LandingSections = defineAsyncComponent(
  () => import('@/features/landing/components/LandingSections.vue'),
)
const LandingFooter = defineAsyncComponent(
  () => import('@/features/landing/components/LandingFooter.vue'),
)
</script>
