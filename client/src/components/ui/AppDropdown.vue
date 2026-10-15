<template>
  <div
    ref="root"
    class="relative inline-block text-left"
  >
    <div
      ref="triggerWrapper"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <slot
        name="trigger"
        :open="open"
        :toggle="toggle"
      />
    </div>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
      @after-enter="onAfterEnter"
      @before-leave="onBeforeLeave"
    >
      <div
        v-show="open"
        ref="panel"
        class="absolute z-20 mt-2 origin-top-right rounded-2xl border shadow-xl ring-1 overflow-hidden"
        :class="[
          panelClass,
          light
            ? 'bg-white border-gray-100 ring-black/5'
            : 'bg-cardSecondary border-white/10 ring-white/10',
        ]"
        role="menu"
        @keydown="onPanelKeydown"
        @click="handlePanelClick"
      >
        <div
          ref="panelContent"
          class="py-1"
        >
          <slot
            :close="close"
            :open="open"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  panelClass: { type: String, default: 'right-0 w-56' },
  closeOnSelect: { type: Boolean, default: true },
  hoverOpen: { type: Boolean, default: false },
  light: { type: Boolean, default: false },
})

const root = ref(null)
const triggerWrapper = ref(null)
const panel = ref(null)
const panelContent = ref(null)
const open = ref(false)
let lastFocusedTrigger = null

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
  if (lastFocusedTrigger) {
    lastFocusedTrigger.focus()
    lastFocusedTrigger = null
  }
}

function onPanelKeydown(e) {
  if (e.key === 'Escape') {
    close()
    return
  }

  const focusable = getFocusableElements()
  if (!focusable.length) return

  const currentIndex = focusable.findIndex((el) => el === document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % focusable.length : 0
    focusable[nextIndex].focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const nextIndex =
      currentIndex >= 0
        ? (currentIndex - 1 + focusable.length) % focusable.length
        : focusable.length - 1
    focusable[nextIndex].focus()
  } else if (e.key === 'Home') {
    e.preventDefault()
    focusable[0].focus()
  } else if (e.key === 'End') {
    e.preventDefault()
    focusable[focusable.length - 1].focus()
  } else if (e.key === 'Tab') {
    // Trap focus within panel
    if (e.shiftKey && document.activeElement === focusable[0]) {
      e.preventDefault()
      focusable[focusable.length - 1].focus()
    } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      e.preventDefault()
      focusable[0].focus()
    }
  }
}

function getFocusableElements() {
  if (!panelContent.value) return []
  return Array.from(
    panelContent.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

function onAfterEnter() {
  lastFocusedTrigger = document.activeElement
  nextTick(() => {
    const focusable = getFocusableElements()
    if (focusable.length) focusable[0].focus()
  })
}

function onBeforeLeave() {
  // focus will be restored in close()
}

function handlePanelClick() {
  if (props.closeOnSelect) {
    // Don't close immediately - let the clicked element handle it
    // The slot elements should call the close function passed to them
  }
}

function onFocusIn() {
  // focusin on trigger wrapper - open on hoverOpen
  if (props.hoverOpen) open.value = true
}

function onFocusOut(e) {
  // focusout - close if focus leaves dropdown entirely
  if (props.hoverOpen && root.value && !root.value.contains(e.relatedTarget)) {
    open.value = false
  }
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
function onEsc(e) {
  if (e.key === 'Escape') open.value = false
}
function onOtherOpen(e) {
  if (e.detail !== root.value) open.value = false
}

watch(open, (v) => {
  if (v) window.dispatchEvent(new CustomEvent('app-dropdown:open', { detail: root.value }))
})

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

defineExpose({ open, close })
</script>
