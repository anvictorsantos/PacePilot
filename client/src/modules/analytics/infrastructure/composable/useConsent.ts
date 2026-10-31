import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { AnalyticsConsent } from '@/modules/analytics/domain/value-object/AnalyticsConsent.ts'
import { analyticsModule } from '@/modules/analytics/infrastructure/container/analytics-container.ts'

// Read once at import (the repository is synchronous, so the banner never
// flashes) and shared by every consumer: the banner asks, the tracker obeys.
const decision = ref<AnalyticsConsent | null>(analyticsModule.consent.read())

export function useConsent() {
  const route = useRoute()
  const decided = computed(() => decision.value !== null)
  const granted = computed(() => decision.value === AnalyticsConsent.Granted)

  function decide(consent: AnalyticsConsent): void {
    analyticsModule.decideConsent.execute(consent)
    decision.value = consent
    // Consent Mode allowed no storage before this moment, so this visit is the
    // first one worth counting. Route pattern only: no activity id leaves the device.
    if (consent === AnalyticsConsent.Granted) {
      analyticsModule.trackPageView.execute(route.matched[0]?.path ?? route.path)
    }
  }

  return { decision, decided, granted, decide }
}
