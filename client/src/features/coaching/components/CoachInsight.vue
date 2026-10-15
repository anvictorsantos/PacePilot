<template>
  <Skeleton v-if="loading" />
  <div
    v-else
    class="bg-gradient-to-br from-primary/20 to-card border border-primary/20 rounded-2xl p-5"
  >
    <div class="text-primary text-xs tracking-widest font-semibold mb-2">
      {{ $t('ui.coach_insight') }}
    </div>
    <ul class="space-y-2">
      <li
        v-for="(r, i) in reasons"
        :key="i"
        class="text-white text-sm flex gap-2 items-start"
      >
        <ChevronRightIcon cls="w-4 h-4 shrink-0 mt-0.5 text-primary" /> {{ r }}
      </li>
    </ul>
    <div
      v-if="!reasons || !reasons.length"
      class="text-muted text-sm"
    >
      {{ $t('ui.no_insights_yet') }}
    </div>
  </div>
</template>
<script setup lang="ts">
import ChevronRightIcon from '@/components/icons/ChevronRightIcon.vue'
import Skeleton from '@/components/ui/Skeleton.vue'
defineProps({
  reasons: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
</script>
