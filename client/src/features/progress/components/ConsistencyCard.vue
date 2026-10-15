<template>
  <div
    class="flex flex-col items-start gap-3 self-stretch w-full rounded-2xl border border-white/10 bg-card p-4"
  >
    <p class="font-bold text-label leading-label uppercase tracking-widest text-muted self-stretch">
      {{ title }}
    </p>
    <div class="flex flex-row items-center justify-between self-stretch">
      <p class="font-black text-[28px] leading-[34px] text-white">
        {{ pct != null ? pct + '%' : '—' }}
      </p>
      <p
        v-if="delta"
        class="font-semibold text-body leading-4 text-success text-right"
      >
        {{ delta }}
      </p>
    </div>
    <p class="font-normal text-xs leading-[15px] text-muted self-stretch">
      {{
        hint ||
        'Calculated based on scheduled runs completed within optimal pace threshold offsets.'
      }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: { type: String, default: '28d Adherence & Consistency' },
  pct: { type: Number, default: null },
  delta: { type: String, default: '+4% improvement' },
  hint: { type: String, default: '' },
  completed: { type: Number, default: 0 },
  planned: { type: Number, default: 0 },
  subtitle: { type: String, default: '' },
})
</script>
