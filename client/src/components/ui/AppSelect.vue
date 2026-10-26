<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      :id="id"
      ref="trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      class="grid w-full cursor-pointer grid-cols-1 rounded-xl bg-cardSecondary border border-white/10 py-2.5 pr-9 pl-3 text-left text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/50 focus:border-primary/50 sm:text-sm"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="col-start-1 row-start-1 truncate pr-6">{{ selectedLabel }}</span>
      <ChevronUpDownIcon
        cls="col-start-1 row-start-1 w-5 h-5 self-center justify-self-end text-muted pointer-events-none"
      />
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
      @after-enter="onAfterEnter"
    >
      <ul
        v-show="open"
        ref="listbox"
        role="listbox"
        :aria-labelledby="id"
        class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-cardSecondary border border-white/10 py-1 shadow-lg focus:outline-hidden text-sm"
        @keydown="onListboxKeydown"
      >
        <li
          v-for="opt in options"
          :id="`${id}-option-${String(opt.value)}`"
          :key="String(opt.value)"
          ref="optionsRef"
          role="option"
          :aria-selected="modelValue === opt.value"
          class="relative cursor-pointer select-none py-2 pr-9 pl-3"
          :class="
            modelValue === opt.value
              ? 'bg-primary text-background'
              : 'text-background hover:bg-white/5'
          "
          tabindex="-1"
          @click="select(opt.value)"
          @keydown="onOptionKeydown(opt.value, $event)"
        >
          <span
            class="block truncate"
            :class="modelValue === opt.value ? 'font-semibold' : 'font-normal'"
            >{{ opt.label }}</span
          >
          <span
            v-if="modelValue === opt.value"
            class="absolute inset-y-0 right-0 flex items-center pr-3 text-white"
          >
            <CheckIcon cls="w-4 h-4" />
          </span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, type PropType } from 'vue'

import CheckIcon from '@/components/icons/CheckIcon.vue'
import ChevronUpDownIcon from '@/components/icons/ChevronUpDownIcon.vue'

interface SelectOption {
  label: string
  value: string | number
}

// Template refs bound to the rendered <li> options. `optionValue` is not a real
// DOM property — it is `undefined` at runtime — but the listbox keydown handler
// reads it off the element, so the element type carries it to keep that
// pre-existing behaviour expressible.
type OptionElement = HTMLLIElement & { optionValue: string | number }

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array as PropType<SelectOption[]>, required: true },
  id: { type: String, default: undefined },
})

const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const listbox = ref<HTMLElement | null>(null)
const optionsRef = ref<OptionElement[]>([])
const open = ref(false)
const highlightedIndex = ref(-1)

const selectedLabel = computed(() => {
  const found = props.options.find((o) => String(o.value) === String(props.modelValue))
  return found ? found.label : 'Select…'
})

function optionIndex(value: string | number) {
  return props.options.findIndex((o) => String(o.value) === String(value))
}

function toggle() {
  open.value = !open.value
}

function select(value: string | number) {
  emit('update:modelValue', value)
  open.value = false
  nextTick(() => {
    trigger.value?.focus()
  })
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    open.value = true
  } else if (e.key === 'Escape') {
    open.value = false
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    open.value = !open.value
  } else if (e.key === 'Tab') {
    open.value = false
  }
}

function onListboxKeydown(e: KeyboardEvent) {
  const options = optionsRef.value
  if (!options.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % options.length
    scrollToOption(highlightedIndex.value)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value - 1 + options.length) % options.length
    scrollToOption(highlightedIndex.value)
  } else if (e.key === 'Home') {
    e.preventDefault()
    highlightedIndex.value = 0
    scrollToOption(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    highlightedIndex.value = options.length - 1
    scrollToOption(options.length - 1)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (highlightedIndex.value >= 0) {
      const option = options[highlightedIndex.value]
      if (option) select(option.optionValue)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    nextTick(() => trigger.value?.focus())
  } else if (e.key === 'Tab') {
    open.value = false
  }
}

function scrollToOption(index: number) {
  const option = optionsRef.value[index]
  if (option && listbox.value) {
    option.scrollIntoView({ block: 'nearest' })
  }
}

function onAfterEnter() {
  const selectedIdx = optionIndex(props.modelValue)
  highlightedIndex.value = selectedIdx >= 0 ? selectedIdx : 0
  nextTick(() => {
    scrollToOption(highlightedIndex.value)
    optionsRef.value[highlightedIndex.value]?.focus?.()
  })
}

function onOptionKeydown(value: string | number, e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    select(value)
  }
}

function onClickOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node | null)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>
