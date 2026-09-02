<template>
  <!-- Tailwind Plus — Elements / Dropdowns — https://tailwindcss.com/plus/ui-blocks/application-ui/elements/dropdowns -->
  <!-- Dark-adapted: bg-cardSecondary, border-white/10, rounded-xl, ring-1 ring-white/10, no Headless UI -->
  <div ref="root" class="relative inline-block text-left">
    <!-- trigger -->
    <div @click="open = !open" @mouseenter="hoverOpen && (open = true)">
      <slot name="trigger" :open="open" />
    </div>

    <!-- panel -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-show="open"
        class="absolute z-20 mt-2 origin-top-right rounded-xl bg-cardSecondary border border-white/10 shadow-xl ring-1 ring-white/10 focus:outline-none overflow-hidden"
        :class="panelClass"
        role="menu"
        @click="closeOnSelect && (open = false)"
      >
        <div class="py-1">
          <slot :close="() => (open = false)" :open="open" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

defineProps({
  panelClass: { type: String, default: 'right-0 w-56' },
  closeOnSelect: { type: Boolean, default: true },
  hoverOpen: { type: Boolean, default: false },
})

const root = ref(null)
const open = ref(false)

// mutual exclusion: only one dropdown open at a time
function onOtherOpen(e) {
  if (e.detail !== root.value) open.value = false
}
watch(open, (v) => {
  if (v) window.dispatchEvent(new CustomEvent('app-dropdown:open', { detail: root.value }))
})

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
function onEsc(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onEsc)
  window.addEventListener('app-dropdown:open', onOtherOpen)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onEsc)
  window.removeEventListener('app-dropdown:open', onOtherOpen)
})

defineExpose({ open })
</script>
