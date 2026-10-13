<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="text-white text-2xl font-bold">Activities</h1>
      <select v-model="filter" @change="load" class="bg-card border border-white/10 text-white text-sm rounded-xl px-3 py-2">
        <option value="all">All</option>
        <option value="easy">Easy</option>
        <option value="long">Long</option>
        <option value="tempo">Tempo</option>
        <option value="threshold">Threshold</option>
        <option value="interval">Interval</option>
        <option value="recovery">Recovery</option>
      </select>
    </div>
    <div v-if="loading" class="mt-6 animate-pulse space-y-3">
      <div class="h-32 bg-card rounded-2xl"></div><div class="h-32 bg-card rounded-2xl"></div>
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
import api from '../services/api.js'
import ActivityCard from '../components/ui/ActivityCard.vue'
const items = ref([]); const total = ref(0); const page = ref(1); const perPage = 12; const loading = ref(true); const filter = ref('all')
async function load() {
  loading.value = true
  try { const { data } = await api.get('/activities', { params: { page: page.value, perPage, type: filter.value } }); items.value = data.items; total.value = data.total } catch {} finally { loading.value = false }
}
onMounted(load)
</script>
