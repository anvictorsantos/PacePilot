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

<script setup>
import LandingNav from '@/components/landing/LandingNav.vue'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingSections from '@/components/landing/LandingSections.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
</script>
