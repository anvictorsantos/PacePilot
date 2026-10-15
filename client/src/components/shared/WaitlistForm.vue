<template>
  <div class="flex w-full flex-col gap-3">
    <p class="text-center text-xs text-muted">
      {{ $t('waitlist.spotsFull', { used, limit }) }}
    </p>
    <a
      :href="whatsappUrl"
      target="_blank"
      rel="noopener"
      class="flex min-h-touch items-center justify-center gap-2 rounded-lg bg-success px-5.5 font-bold text-sm text-white transition hover:brightness-110"
    >
      {{ $t('waitlist.join') }}
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps({
  used: { type: Number, default: 0 },
  limit: { type: Number, default: 10 },
  inputId: { type: String, default: 'waitlist-email' },
})

const whatsappUrl =
  'https://api.whatsapp.com/send?phone=351938746747&text=Ol%C3%A1!%20%F0%9F%98%8A%20Tudo%20bem%3F%0A%0AEu%20tenho%20interesse%20em%20participar%20no%20PacePilot.%20'
</script>
