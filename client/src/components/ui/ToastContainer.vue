<template>
  <div
    v-for="(group, position) in grouped"
    :key="position"
    class="fixed z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-[calc(100%-2rem)]"
    :class="POSITION_CLASSES[position] || POSITION_CLASSES['top-right']"
  >
    <TransitionGroup enter-active-class="transition-all duration-250 ease-out" leave-active-class="transition-all duration-200 ease-in" enter-from-class="opacity-0 -translate-y-2 scale-[0.98]" leave-to-class="opacity-0 -translate-y-1 scale-[0.98]" move-class="transition-transform duration-250 ease-out">
      <div
        v-for="t in group"
        :key="t.id"
        class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur text-sm font-medium w-full"
        :class="typeClasses(t.type)"
      >
        <component :is="iconFor(t)" class="shrink-0 w-5 h-5 mt-0.5" />
        <span class="flex-1 leading-snug">{{ t.message }}</span>
        <button
          @click="dismiss(t.id)"
          class="flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition -my-2 -mr-2 min-h-touch min-w-[44px]"
          aria-label="Dismiss"
        ><XMarkIcon cls="w-4 h-4" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useToast } from '@/composables/useToast.js'
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import XCircleIcon from '@/components/icons/XCircleIcon.vue'
import ExclamationTriangleIcon from '@/components/icons/ExclamationTriangleIcon.vue'
import InformationCircleIcon from '@/components/icons/InformationCircleIcon.vue'
import XMarkIcon from '@/components/icons/XMarkIcon.vue'

const { toasts, dismiss, POSITION_CLASSES } = useToast()

const grouped = computed(() => {
  const g = {}
  for (const t of toasts.value) {
    const p = t.position || 'top-right'
    if (!g[p]) g[p] = []
    g[p].push(t)
  }
  return g
})

function typeClasses(type) {
  switch (type) {
    case 'success': return 'bg-emerald-500 text-white border-emerald-600'
    case 'error':   return 'bg-red-500 text-white border-red-600'
    case 'warning': return 'bg-amber-500 text-white border-amber-600'
    case 'info':    return 'bg-zinc-800 text-white border-white/10'
    default:        return 'bg-zinc-800 text-white border-white/10'
  }
}

const TYPE_ICON = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
}

function iconFor(t) {
  if (t.iconComponent) return t.iconComponent
  // legacy string icon overrides — map common ones, ignore decorative "—"
  if (t.icon && t.icon !== '—') return InformationCircleIcon
  return TYPE_ICON[t.type] || InformationCircleIcon
}
</script>


