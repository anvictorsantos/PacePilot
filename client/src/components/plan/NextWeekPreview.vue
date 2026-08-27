<template>
  <div class="flex flex-col gap-3">
    <p class="text-[11px] font-bold uppercase tracking-widest text-muted">Next Week Preview (Week {{ weekNumber }} - Peak Volume)</p>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        v-for="p in items"
        :key="p.title"
        class="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-[6px]">
          <span class="inline-flex self-start rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-normal tracking-wide text-muted">{{ p.badge }}</span>
          <p class="text-sm font-bold leading-normal text-white">{{ p.title }}</p>
          <p class="text-xs font-normal leading-normal text-muted">{{ p.desc }}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end leading-normal">
          <p class="text-lg font-black leading-none text-white">{{ p.distance }}</p>
          <p class="text-[11px] font-normal text-muted">Estimated</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  weekNumber: { type: Number, required: true },
  items: {
    type: Array,
    default: () => [
      { badge: 'INTERVALS', title: 'Aerobic Capacity', desc: '5x1000m hard intervals with resting recoveries.', distance: '8.0 km' },
      { badge: 'TEMPO RUN', title: 'Lactate Threshold', desc: '5.0 km sustained hard tempo block.', distance: '9.0 km' },
      { badge: 'LONG RUN', title: 'Endurance Building', desc: 'Long progressive endurance run.', distance: '14.0 km' },
    ],
  },
})
</script>
