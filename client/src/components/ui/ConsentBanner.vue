<template>
  <!-- Not a modal: nothing is trapped, and the page stays usable while it asks. -->
  <div
    v-if="!decided"
    id="analytics-consent"
    role="region"
    aria-labelledby="analytics-consent-title"
    class="bottom-16 md:bottom-0 z-40 fixed inset-x-0 bg-card/95 backdrop-blur border-white/10 border-t"
  >
    <div
      class="flex md:flex-row flex-col md:items-center gap-3 md:gap-5 mx-auto px-4 sm:px-6 py-4 max-w-shell"
    >
      <div class="flex flex-col flex-1 gap-1 min-w-0">
        <p
          id="analytics-consent-title"
          class="font-medium text-label text-primary"
        >
          {{ $t('consent.title') }}
        </p>
        <p class="text-body text-ink leading-body">
          {{ $t('consent.message') }}
        </p>
        <button
          type="button"
          class="cursor-pointer self-start font-medium text-faint text-label hover:text-primary underline transition"
          @click="legal = true"
        >
          {{ $t('consent.privacy') }}
        </button>
      </div>
      <div class="flex sm:flex-row flex-col sm:items-center gap-3 shrink-0">
        <button
          type="button"
          class="bg-transparent px-5 border border-white/20 hover:border-white/30 rounded-lg min-h-touch font-medium text-body text-muted hover:text-primary transition cursor-pointer"
          @click="decide(AnalyticsConsent.Denied)"
        >
          {{ $t('consent.decline') }}
        </button>
        <button
          type="button"
          class="bg-primary hover:bg-primaryBright px-5 rounded-lg min-h-touch font-medium text-body text-background transition cursor-pointer"
          @click="decide(AnalyticsConsent.Granted)"
        >
          {{ $t('consent.accept') }}
        </button>
      </div>
    </div>
    <LegalModal
      :show="legal"
      doc="privacy"
      @close="legal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import LegalModal from '@/components/ui/LegalModal.vue'
import { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { useConsent } from '@/modules/analytics/infrastructure/composable/useConsent.ts'

const { decided, decide } = useConsent()
const legal = ref(false)
</script>
