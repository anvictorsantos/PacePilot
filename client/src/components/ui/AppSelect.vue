<template>
  <!-- Tailwind Plus — Select Menus / Simple (custom, no Headless UI) — https://tailwindcss.com/plus/ui-blocks/application-ui/forms/select-menus -->
  <div ref="root" class="relative">
    <button
      type="button"
      :id="id"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
      @keydown.down.prevent="open = true"
      @keydown.esc.prevent="open = false"
      class="grid w-full cursor-pointer grid-cols-1 rounded-xl bg-cardSecondary border border-white/10 py-2.5 pr-9 pl-3 text-left text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 sm:text-sm"
    >
      <span class="col-start-1 row-start-1 truncate pr-6">{{ selectedLabel }}</span>
      <ChevronUpDownIcon cls="col-start-1 row-start-1 w-5 h-5 self-center justify-self-end text-muted pointer-events-none" />
    </button>

    <ul
      v-show="open"
      role="listbox"
      :aria-labelledby="id"
      class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-cardSecondary border border-white/10 py-1 shadow-lg focus:outline-none text-sm"
    >
      <li
        v-for="opt in options"
        :key="String(opt.value)"
        role="option"
        :aria-selected="modelValue === opt.value"
        @click="select(opt.value)"
        class="relative cursor-pointer select-none py-2 pr-9 pl-3"
        :class="modelValue === opt.value ? 'bg-primary text-white' : 'text-white hover:bg-white/5'"
      >
        <span class="block truncate" :class="modelValue === opt.value ? 'font-semibold' : 'font-normal'">{{ opt.label }}</span>
        <span v-if="modelValue === opt.value" class="absolute inset-y-0 right-0 flex items-center pr-3 text-white">
          <CheckIcon cls="w-4 h-4" />
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ChevronUpDownIcon from '@/components/icons/ChevronUpDownIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  id: { type: String, default: undefined },
})

const emit = defineEmits(['update:modelValue'])

const root = ref(null)
const open = ref(false)

const selectedLabel = computed(() => {
  const found = props.options.find(o => String(o.value) === String(props.modelValue))
  return found ? found.label : 'Select…'
})

function select(value) {
  emit('update:modelValue', value)
  open.value = false
}

function onClickOutside(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>
