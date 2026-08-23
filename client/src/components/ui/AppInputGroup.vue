<template>
  <!-- Tailwind Plus — Input Groups / Input with inline add-on (+ leading/trailing variants) — https://tailwindcss.com/plus/ui-blocks/application-ui/forms/input-groups -->
  <!-- Dark-adapted: bg-cardSecondary, border-white/10, muted add-ons, focus:ring-primary/50 -->
  <div
    class="flex rounded-xl bg-cardSecondary border shadow-sm focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition"
    :class="wrapperClass"
  >
    <!-- leading add-on (text or slot) -->
    <span
      v-if="leadingAddon || $slots.leading"
      class="inline-flex items-center px-3 text-sm whitespace-nowrap shrink-0 select-none rounded-l-xl border-r bg-white/[0.04] text-muted text-xs border-white/10"
    >
      <slot name="leading">{{ leadingAddon }}</slot>
    </span>

    <!-- leading icon (e.g. heroicon) -->
    <span v-if="$slots.leadingIcon" class="pointer-events-none inline-flex items-center pl-3 pr-1 text-muted shrink-0">
      <slot name="leadingIcon" />
    </span>

    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="block min-w-0 flex-1 bg-transparent border-0 px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:ring-0 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      :class="{ 'pl-1': $slots.leadingIcon }"
      @input="onInput"
      @blur="$emit('blur', $event)"
      @focus="$emit('focus', $event)" />

    <!-- trailing icon -->
    <span v-if="$slots.trailingIcon" class="pointer-events-none inline-flex items-center pr-3 pl-1 text-muted shrink-0">
      <slot name="trailingIcon" />
    </span>

    <!-- trailing add-on (text or slot) -->
    <span
      v-if="trailingAddon || $slots.trailing"
      class="inline-flex items-center px-3 text-sm whitespace-nowrap shrink-0 select-none rounded-r-xl border-l bg-white/[0.04] text-muted text-xs border-white/10"
    >
      <slot name="trailing">{{ trailingAddon }}</slot>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, default: undefined },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  leadingAddon: { type: String, default: '' },
  trailingAddon: { type: String, default: '' },
  min: { type: [String, Number], default: undefined },
  max: { type: [String, Number], default: undefined },
  step: { type: [String, Number], default: undefined },
  disabled: { type: Boolean, default: false },
  number: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

const wrapperClass = computed(() =>
  props.disabled ? 'border-white/5 opacity-60' : 'border-white/10'
)

function onInput(e) {
  let v = e.target.value
  if (props.number || props.type === 'number') {
    if (v === '') { emit('update:modelValue', ''); return }
    const n = Number(v)
    emit('update:modelValue', Number.isNaN(n) ? v : n)
    return
  }
  emit('update:modelValue', v)
}
</script>
