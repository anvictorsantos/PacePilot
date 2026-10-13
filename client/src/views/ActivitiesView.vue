<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="text-white text-2xl font-bold">Activities</h1>
      <AppSelect v-model="filter" :options="filterOptions" id="activity-filter" class="w-44" @update:modelValue="onFilterChange" />
    </div>
    <div v-if="loading" class="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ActivityCard v-for="n in 6" :key="n" loading />
    </div>
    <div v-else class="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ActivityCard v-for="a in items" :key="a.id" :activity="a" />
    </div>
    <div v-if="!loading && !items.length" class="mt-6 bg-card border border-white/10 rounded-2xl p-10 text-center text-muted">No activities found.</div>
    <div v-if="total > perPage" class="mt-6 flex justify-center gap-2">
      <button @click="page--, load()" :disabled="page<=1" class="px-4 py-2 bg-card border border-white/10 rounded-xl text-white text-sm disabled:opacity-40">Prev</button>
      <span class="px-3 py-2 text-muted text-sm">Page {{ page }}</span>
      <button @click="page++, load()" :disabled="items.length < perPage" class="px-4 py-2 bg-card border border-white/10 rounded-xl text-white text-sm disabled:opacity-40">Next</button>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api.js'
import ActivityCard from '@/components/ui/ActivityCard.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
const items = ref([]); const total = ref(0); const page = ref(1); const perPage = 12; const loading = ref(true); const filter = ref('all')
const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'long', label: 'Long' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'interval', label: 'Interval' },
  { value: 'recovery', label: 'Recovery' },
]
function onFilterChange() { page.value = 1; load() }
async function load() {
  loading.value = true
  try { const { data } = await api.get('/activities', { params: { page: page.value, perPage, type: filter.value } }); items.value = data.items; total.value = data.total } catch {} finally { loading.value = false }
}
onMounted(load)
</script>
