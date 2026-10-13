<template>
  <div class="flex flex-col self-stretch gap-4 bg-card p-5 border border-white/10 rounded-2xl w-full">
    <div class="flex justify-between items-center">
      <p class="font-bold text-[11px] text-muted uppercase tracking-widest">Best Efforts</p>
      <p class="font-normal text-[11px] text-muted">Top 3 by pace</p>
    </div>
    <div v-if="!records?.length" class="text-muted text-sm">No records yet — keep running.</div>
    <div v-else class="flex flex-col">
      <div
        v-for="r in records"
        :key="r.id"
        class="flex justify-between items-center py-3 border-white/10 last:border-0 border-b"
      >
        <div class="flex flex-col gap-0.5">
          <span class="font-semibold text-white text-sm">{{ r.distance_km }} km</span>
          <span class="font-normal text-[11px] text-muted">{{ new Date(r.date).toLocaleDateString() }}</span>
        </div>
        <span class="font-black text-white text-lg leading-none">{{ Math.floor(r.pace / 60) }}:{{ String(r.pace % 60).padStart(2, "0") }} <span class="font-normal text-[11px] text-muted">/km</span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ records: { type: Array, default: () => [] } })
</script>
