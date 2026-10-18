<template>
  <Teleport to="body">
    <Transition name="legal-fade">
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -- overlay closes on click; Escape is owned by useDialog while the modal is open -->
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="close"
      >
        <Transition
          name="legal-pop"
          appear
        >
          <div
            v-if="show"
            ref="dialog"
            v-bind="dialogAttrs"
            class="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-card p-6 text-white sm:p-8"
          >
            <div class="flex items-start justify-between gap-4">
              <h2
                :id="dialogTitleId"
                class="text-xl font-extrabold text-white"
              >
                {{ $t(`legal.${docName}.title`) }}
              </h2>
              <button
                ref="closeButton"
                type="button"
                :aria-label="$t('common.close')"
                class="flex items-center justify-center rounded-lg min-h-touch min-w-touch text-muted transition hover:bg-white/10 hover:text-white"
                @click="close"
              >
                <XMarkIcon cls="h-5 w-5" />
              </button>
            </div>
            <p class="mt-1 text-xs text-muted">{{ $t('legal.updated') }}</p>
            <div class="mt-4 flex flex-col gap-4">
              <div
                v-for="i in [1, 2, 3, 4, 5]"
                :key="i"
              >
                <p class="text-sm font-bold text-primary">
                  {{ $t(`legal.${docName}.sections.${i}.heading`) }}
                </p>
                <p class="mt-1 text-sm leading-body text-muted">
                  {{ $t(`legal.${docName}.sections.${i}.body`) }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition hover:brightness-110"
              @click="close"
            >
              {{ $t('common.understood') }}
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import { useDialog } from '@/modules/shared/ui/useDialog.ts'

const props = defineProps({
  show: { type: Boolean, default: false },
  doc: {
    type: String,
    default: 'privacy',
    validator: (v) => typeof v === 'string' && ['privacy', 'terms'].includes(v),
  },
})
const emit = defineEmits(['close'])

const docName = computed(() => (props.doc === 'terms' ? 'terms' : 'privacy'))

const dialog = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLElement | null>(null)
const dialogTitleId = `legal-dialog-title-${docName.value}`

const { attrs: dialogAttrs } = useDialog(dialog, {
  active: computed(() => props.show),
  labelledby: dialogTitleId,
  onEscape: close,
  initialFocus: closeButton,
})

function close() {
  emit('close')
}
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
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.legal-pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.legal-pop-enter-from,
.legal-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
