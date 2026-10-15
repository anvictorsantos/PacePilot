<template>
  <button
    class="inline-flex items-center gap-2 bg-strava hover:bg-stravaDark text-white font-semibold px-6 py-3 rounded-xl transition"
    @click="$emit('click')"
  >
    <LinkIcon cls="w-5 h-5" /> <slot>{{ $t('ui.connect_with_strava') }}</slot>
  </button>
</template>

<script setup>
defineEmits(['click'])
import LinkIcon from '@/components/icons/LinkIcon.vue'
</script>
