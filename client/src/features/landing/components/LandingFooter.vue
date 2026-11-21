<template>
  <section
    id="start"
    class="bg-card border-white/10 border-y scroll-mt-20"
  >
    <div
      class="flex lg:flex-row flex-col lg:justify-between lg:items-center gap-8 mx-auto px-6 lg:px-12 py-16 max-w-[1240px]"
    >
      <div class="flex flex-col gap-5 max-w-[840px]">
        <p class="font-mono text-label text-faint">{{ $t('landing.cta.kicker') }}</p>
        <h2 class="font-medium lg:text-[52px] text-4xl leading-[1.04] tracking-[-0.035em]">
          {{ $t('landing.cta.titleLine1') }}<br />{{ $t('landing.cta.titleLine2') }}
        </h2>
        <p class="text-muted">{{ $t('landing.cta.subtitle') }}</p>
      </div>
      <div class="flex flex-col items-center lg:items-end gap-3.5 w-full max-w-[440px]">
        <template v-if="isFull">
          <WaitlistForm
            :used="slotUsed"
            :limit="slotLimit"
            input-id="footer-waitlist"
            @join="trackEvent(AnalyticsEventName.WaitlistJoin)"
          />
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="flex items-center gap-3 bg-primary hover:brightness-110 px-4.5 py-2.5 rounded-lg font-medium text-body text-background transition"
          >
            {{ $t('nav.explore') }}<ArrowUpRightIcon cls="h-[18px] w-[18px] text-background" />
          </RouterLink>
          <p class="text-label text-faint">{{ $t('landing.cta.note') }}</p>
        </template>
      </div>
    </div>
  </section>

  <footer
    id="privacy"
    class="flex flex-col gap-8 mx-auto px-6 lg:px-12 py-9 max-w-[1240px] scroll-mt-20"
  >
    <div class="flex justify-between items-start text-faint text-label">
      <p>{{ $t('common.rights') }}</p>

      <div class="flex lg:flex-row flex-col gap-6">
        <div class="flex sm:flex-row flex-col sm:items-center gap-3 sm:gap-5 ml-auto">
          <p class="text-muted text-label">{{ $t('common.brandTagline') }}</p>
          <a
            href="https://buymeacoffee.com/pacepilot"
            target="_blank"
            rel="noopener"
            class="flex items-center self-start gap-2 hover:bg-accent/10 px-4 py-2 border border-white/20 rounded-lg font-mono text-label text-faint transition"
          >
            <CoffeeIcon cls="h-4 w-4" />
            {{ $t('landing.cta.coffee') }}</a
          >
        </div>
      </div>
    </div>
  </footer>
  <LegalModal
    :show="legal !== null"
    :doc="legal || 'privacy'"
    @close="legal = null"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import ArrowUpRightIcon from '@/components/icons/ArrowUpRightIcon.vue'
import CoffeeIcon from '@/components/icons/CoffeeIcon.vue'
import WaitlistForm from '@/components/shared/WaitlistForm.vue'
import LegalModal from '@/components/ui/LegalModal.vue'
import { AnalyticsEventName } from '@/modules/analytics/domain/value-object/AnalyticsEventName.ts'
import { useAnalytics } from '@/modules/analytics/infrastructure/composable/useAnalytics.ts'
import { useCapacity } from '@/modules/waitlist/infrastructure/composable/useCapacity.ts'

const legal = ref(null)
const { trackEvent } = useAnalytics()
const { full: isFull, used: slotUsed, limit: slotLimit, checkCapacity } = useCapacity()

onMounted(() => {
  checkCapacity()
})
</script>
