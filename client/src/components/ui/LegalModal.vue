<template>
  <Teleport to="body">
    <Transition name="legal-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="close"
        role="dialog"
        aria-modal="true"
        :aria-label="doc.title"
      >
        <Transition name="legal-pop" appear>
          <div v-if="show" class="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-card p-6 text-white sm:p-8">
            <div class="flex items-start justify-between gap-4">
              <h2 class="text-xl font-extrabold text-white">{{ doc.title }}</h2>
              <button @click="close" aria-label="Close" class="flex items-center justify-center rounded-lg min-h-touch min-w-[44px] text-muted transition hover:bg-white/10 hover:text-white">
                <XMarkIcon cls="h-5 w-5" />
              </button>
            </div>
            <p class="mt-1 text-xs text-muted">Last updated October 2026</p>
            <div class="mt-4 flex flex-col gap-4">
              <div v-for="s in doc.sections" :key="s.h">
                <p class="text-sm font-bold text-primary">{{ s.h }}</p>
                <p class="mt-1 text-sm leading-body text-muted">{{ s.p }}</p>
              </div>
            </div>
            <button @click="close" class="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition hover:brightness-110">I understood</button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onUnmounted } from 'vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  doc: { type: String, default: 'privacy', validator: (v) => ['privacy', 'terms'].includes(v) },
})
const emit = defineEmits(['close'])

const copy = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: 'What we collect', p: 'Your Strava profile (name, photo), activities (distance, pace, heart rate, elevation) and your training feedback (RPE, notes). Nothing else.' },
      { h: 'Why', p: 'Solely to build your adaptive coaching plan and show your progress. No advertising, no sale, no sharing with third parties.' },
      { h: 'Where it lives', p: 'Activities and profile data live in our MongoDB database. Strava access tokens are encrypted and never leave the server.' },
      { h: 'Your rights (RGPD / GDPR)', p: 'Access, correct or erase your data anytime. Disconnect stops all collection; Settings → Delete my account permanently erases your athlete profile, activities and feedback.' },
      { h: 'Retention', p: 'Data is kept while your account exists and deleted immediately when you erase it. Revoking Strava access stops future syncs.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { h: 'The service', p: 'PacePilot turns your Strava history into an adaptive running plan. A Strava account and connection are required to use it.' },
      { h: 'Not medical advice', p: 'Training guidance is evidence-based but generic. It is not medical advice, diagnosis or treatment. Consult a professional for injuries or health conditions. Train at your own risk.' },
      { h: 'Fair use', p: 'Connect only your own Strava account. Do not abuse sync or share sessions to scrape data.' },
      { h: 'Availability', p: 'Provided as-is, without uptime guarantees. The service depends on Strava API availability and rate limits.' },
      { h: 'Ending it', p: 'Disconnect anytime to stop collection, or erase everything via Settings → Delete my account.' },
    ],
  },
}

const doc = copy[props.doc] ?? copy.privacy

function close() {
  emit('close')
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.show,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)
onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.legal-fade-enter-active,
.legal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.legal-fade-enter-from,
.legal-fade-leave-to {
  opacity: 0;
}
.legal-pop-enter-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.legal-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.legal-pop-enter-from,
.legal-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
