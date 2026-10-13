<template>
  <div class="max-w-2xl">
    <h1 class="text-white text-2xl font-bold">Settings</h1>
    <div class="mt-6 space-y-4">
      <div class="bg-card border border-white/10 rounded-2xl p-6">
        <div class="text-white font-semibold text-sm">Profile</div>
        <div class="text-muted text-sm mt-1">Your connected Strava athlete</div>
        <div class="text-muted text-xs mt-2">Timezone: Europe/Lisbon</div>
      </div>
      <div class="bg-card border border-white/10 rounded-2xl p-6">
        <div class="text-white font-semibold text-sm">Data</div>
        <p class="text-muted text-sm mt-1">Activities are stored locally or in MongoDB when configured. Strava tokens never leave the server.</p>
      </div>
      <div class="bg-card border border-white/10 rounded-2xl p-6">
        <div class="text-white font-semibold text-sm">About PacePilot</div>
        <p class="text-muted text-sm mt-1">Adaptive running coach — Strava supplies the evidence, the training engine decides, the coach explains.</p>
      </div>
    </div>
  </div>
</template>
