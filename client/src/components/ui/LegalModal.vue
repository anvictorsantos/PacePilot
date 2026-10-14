<template>
  <Teleport to="body">
    <Transition name="legal-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="close"
        role="dialog"
        aria-modal="true"
        :aria-label="docTitle"
      >
        <Transition name="legal-pop" appear>
          <div v-if="show" class="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-card p-6 text-white sm:p-8">
            <div class="flex items-start justify-between gap-4">
              <h2 class="text-xl font-extrabold text-white">{{ $t(`legalDocs.${docKey}.title`) }}</h2>
              <button @click="close" :aria-label="$t('common.close')" class="flex items-center justify-center rounded-lg min-h-touch min-w-touch text-muted transition hover:bg-white/10 hover:text-white">
                <XMarkIcon cls="h-5 w-5" />
              </button>
            </div>
            <p class="mt-1 text-xs text-muted">{{ $t('legal.updated') }}</p>
            <div class="mt-4 flex flex-col gap-4">
              <div v-for="i in [1, 2, 3, 4, 5]" :key="i">
                <p class="text-sm font-bold text-primary">{{ $t(`legalDocs.${docKey}.s${i}h`) }}</p>
                <p class="mt-1 text-sm leading-body text-muted">{{ $t(`legalDocs.${docKey}.s${i}p`) }}</p>
              </div>
            </div>
            <button @click="close" class="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition hover:brightness-110">{{ $t('common.understood') }}</button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  doc: { type: String, default: 'privacy', validator: (v) => ['privacy', 'terms'].includes(v) },
})
const emit = defineEmits(['close'])

const { t } = useI18n()
// privacy → legalDocs.p.*, anything else → legalDocs.t.*
const docKey = computed(() => (props.doc === 'terms' ? 't' : 'p'))
const docTitle = computed(() => t(`legalDocs.${docKey.value}.title`))

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
