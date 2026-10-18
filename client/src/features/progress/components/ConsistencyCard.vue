<template>
  <div
    class="flex flex-col items-start gap-3 self-stretch w-full rounded-2xl border border-white/10 bg-card p-4"
  >
    <p class="font-bold text-label leading-label uppercase tracking-widest text-muted self-stretch">
      {{ title || $t('ui.adherence_title') }}
    </p>
    <div class="flex flex-row items-center justify-between self-stretch">
      <p class="font-black text-[28px] leading-[34px] text-white">
        {{ pct != null ? pct + '%' : '—' }}
      </p>
      <p class="font-semibold text-body leading-4 text-success text-right">
        {{ delta || $t('ui.adherence_delta') }}
      </p>
    </div>
    <p class="font-normal text-xs leading-[15px] text-muted self-stretch">
      {{ hint || $t('ui.adherence_hint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: { type: String, default: '' },
  pct: { type: Number, default: null },
  delta: { type: String, default: '' },
  hint: { type: String, default: '' },
  completed: { type: Number, default: 0 },
  planned: { type: Number, default: 0 },
  subtitle: { type: String, default: '' },
})
</script>
