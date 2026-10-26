<template>
  <div
    v-for="(group, position) in grouped"
    :key="position"
    class="z-toast fixed flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
    :class="(POSITION_CLASSES as Record<string, string>)[position] || POSITION_CLASSES['top-right']"
    role="region"
    aria-live="polite"
    :aria-label="$t('ui.notifications')"
  >
    <TransitionGroup
      enter-active-class="transition-all duration-250 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 -translate-y-2 scale-[0.98]"
      leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
      move-class="transition-transform duration-250 ease-out"
    >
      <div
        v-for="t in group"
        :key="t.id"
        class="flex items-start gap-3 shadow-lg backdrop-blur px-4 py-3 border-border rounded-xl w-full font-medium text-sm pointer-events-auto"
        :class="typeClasses(t.type)"
        role="alert"
        :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
      >
        <component
          :is="iconFor(t)"
          class="mt-0.5 w-5 h-5 shrink-0"
          aria-hidden="true"
        />
        <span class="flex-1 leading-snug">{{ t.message }}</span>
        <button
          class="flex justify-center items-center opacity-60 hover:opacity-100 -my-2 -mr-2 min-w-[44px] min-h-touch transition cursor-pointer shrink-0"
          :aria-label="$t('ui.dismiss')"
          @click="dismiss(t.id)"
        >
          <XMarkIcon cls="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
  <!-- One live region is always present, empty or not: a region that only
       appears with its first message is not reliably announced. -->
  <div
    v-if="!hasToasts"
    class="sr-only"
    role="region"
    aria-live="polite"
    :aria-label="$t('ui.notifications')"
  ></div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'

import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import ExclamationTriangleIcon from '@/components/icons/ExclamationTriangleIcon.vue'
import InformationCircleIcon from '@/components/icons/InformationCircleIcon.vue'
import XCircleIcon from '@/components/icons/XCircleIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import { ToastPosition, ToastType, useToast } from '@/modules/shared/ui/useToast.ts'

const { toasts, dismiss, POSITION_CLASSES } = useToast()

const hasToasts = computed(() => toasts.value.length > 0)

type ToastItem = (typeof toasts.value)[number]

const grouped = computed(() => {
  const g: Partial<Record<ToastPosition, ToastItem[]>> = {}
  for (const t of toasts.value) {
    const bucket = g[t.position] ?? (g[t.position] = [])
    bucket.push(t)
  }
  return g
})

function typeClasses(type: ToastType) {
  switch (type) {
    case ToastType.Success:
      return 'bg-emerald-500 text-white border-emerald-600'
    case ToastType.Error:
      return 'bg-red-500 text-white border-red-600'
    case ToastType.Warning:
      return 'bg-amber-500 text-white border-amber-600'
    case ToastType.Info:
      return 'bg-zinc-800 text-white border-white/10'
    default:
      return 'bg-zinc-800 text-white border-white/10'
  }
}

const TYPE_ICON: Record<ToastType, Component> = {
  [ToastType.Success]: CheckCircleIcon,
  [ToastType.Error]: XCircleIcon,
  [ToastType.Warning]: ExclamationTriangleIcon,
  [ToastType.Info]: InformationCircleIcon,
}

function iconFor(t: ToastItem & { iconComponent?: Component }): Component {
  if (t.iconComponent) return t.iconComponent
  if (t.icon && t.icon !== '—') return InformationCircleIcon
  return TYPE_ICON[t.type] ?? InformationCircleIcon
}
</script>
