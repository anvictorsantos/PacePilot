<template>
  <div class="w-full">
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -- label only renders when id exists, input has matching id -->
    <label
      v-if="label && id"
      :for="id"
      class="block text-muted text-xs uppercase tracking-widest mb-1.5"
    >
      {{ label }}
    </label>
    <div
      class="flex rounded-xl bg-cardSecondary border shadow-sm focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition"
      :class="wrapperClass"
    >
      <span
        v-if="leadingAddon || $slots.leading"
        class="inline-flex items-center px-3 text-sm whitespace-nowrap shrink-0 select-none rounded-l-xl border-r bg-white/[0.04] text-muted text-xs border-white/10"
      >
        <slot name="leading">{{ leadingAddon }}</slot>
      </span>

      <span
        v-if="$slots.leadingIcon"
        class="pointer-events-none inline-flex items-center pl-3 pr-1 text-muted shrink-0"
      >
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
        :aria-describedby="describedById"
        :aria-invalid="ariaInvalid"
        class="block min-w-0 flex-1 bg-transparent border-0 px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:ring-0 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        :class="{ 'pl-1': $slots.leadingIcon }"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />

      <span
        v-if="$slots.trailingIcon"
        class="pointer-events-none inline-flex items-center pr-3 pl-1 text-muted shrink-0"
      >
        <slot name="trailingIcon" />
      </span>

      <span
        v-if="trailingAddon || $slots.trailing"
        class="inline-flex items-center px-3 text-sm whitespace-nowrap shrink-0 select-none rounded-r-xl border-l bg-white/[0.04] text-muted text-xs border-white/10"
      >
        <slot name="trailing">{{ trailingAddon }}</slot>
      </span>
    </div>
    <p
      v-if="error"
      :id="describedById"
      class="mt-1.5 text-danger text-xs"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint && !error"
      :id="describedById"
      class="mt-1.5 text-muted text-xs"
    >
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
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
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  ariaInvalid: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

const wrapperClass = computed(() =>
  props.disabled ? 'border-white/5 opacity-60' : 'border-white/10',
)

const describedById = computed(() => {
  if (props.error || props.hint) return `${props.id}-description`
  return undefined
})

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const v = target.value
  if (props.number || props.type === 'number') {
    if (v === '') {
      emit('update:modelValue', '')
      return
    }
    const n = Number(v)
    emit('update:modelValue', Number.isNaN(n) ? v : n)
    return
  }
  emit('update:modelValue', v)
}
</script>
