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
import LandingFooter from '@/features/landing/components/LandingFooter.vue'
import LandingHero from '@/features/landing/components/LandingHero.vue'
import LandingNav from '@/features/landing/components/LandingNav.vue'
import LandingSections from '@/features/landing/components/LandingSections.vue'
</script>
