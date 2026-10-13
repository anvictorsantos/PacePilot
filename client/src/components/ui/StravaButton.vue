<template>
  <button @click="$emit('click')" class="inline-flex items-center gap-2 bg-[#FC4C02] hover:bg-[#e34400] text-white font-semibold px-6 py-3 rounded-xl transition">
    <LinkIcon cls="w-5 h-5" /> <slot>Connect with Strava</slot>
  </button>
</template>

<script setup>
import LinkIcon from '../icons/LinkIcon.vue'
</script>
