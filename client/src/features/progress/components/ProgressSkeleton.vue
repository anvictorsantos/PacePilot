<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div
      v-for="i in 4"
      :key="i"
      class="bg-card p-4 border border-white/10 rounded-2xl h-24 animate-pulse"
    />
  </div>
</template>
