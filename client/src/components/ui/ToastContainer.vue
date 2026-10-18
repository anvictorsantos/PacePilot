<template>
  <div
    v-for="(group, position) in grouped"
    :key="position"
    class="fixed z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-[calc(100%-2rem)]"
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
        class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur text-sm font-medium w-full"
        :class="typeClasses(t.type)"
        role="alert"
        :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
      >
        <component
          :is="iconFor(t)"
          class="shrink-0 w-5 h-5 mt-0.5"
          aria-hidden="true"
        />
        <span class="flex-1 leading-snug">{{ t.message }}</span>
        <button
          class="flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition -my-2 -mr-2 min-h-touch min-w-[44px]"
          :aria-label="$t('ui.dismiss')"
          @click="dismiss(t.id)"
        >
          <XMarkIcon cls="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'

import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import ExclamationTriangleIcon from '@/components/icons/ExclamationTriangleIcon.vue'
import InformationCircleIcon from '@/components/icons/InformationCircleIcon.vue'
import XCircleIcon from '@/components/icons/XCircleIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'
import { useToast } from '@/composables/useToast.ts'

const { toasts, dismiss, POSITION_CLASSES } = useToast()

type ToastItem = (typeof toasts.value)[number]

const grouped = computed(() => {
  const g: Record<string, ToastItem[]> = {}
  for (const t of toasts.value) {
    const p = t.position || 'top-right'
    const bucket = g[p] ?? (g[p] = [])
    bucket.push(t)
  }
  return g
})

function typeClasses(type: string) {
  switch (type) {
    case 'success':
      return 'bg-emerald-500 text-white border-emerald-600'
    case 'error':
      return 'bg-red-500 text-white border-red-600'
    case 'warning':
      return 'bg-amber-500 text-white border-amber-600'
    case 'info':
      return 'bg-zinc-800 text-white border-white/10'
    default:
      return 'bg-zinc-800 text-white border-white/10'
  }
}

const TYPE_ICON: Record<string, Component> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
}

function iconFor(t: ToastItem & { iconComponent?: Component }): Component {
  if (t.iconComponent) return t.iconComponent
  if (t.icon && t.icon !== '—') return InformationCircleIcon
  return TYPE_ICON[t.type] || InformationCircleIcon
}
</script>
