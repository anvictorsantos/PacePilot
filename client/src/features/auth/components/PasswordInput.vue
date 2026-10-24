<template>
  <div class="relative">
    <input
      :id="id"
      :type="visible ? 'text' : 'password'"
      :value="modelValue"
      :name="name || id"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :minlength="minlength"
      :maxlength="maxlength"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedby"
      class="bg-cardSecondary px-4 py-3 pr-12 border border-border rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-full min-h-touch text-body text-white placeholder:text-faint"
      @input="onInput"
    />
    <button
      type="button"
      class="top-1/2 right-1 absolute flex justify-center items-center hover:bg-white/5 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary w-11 h-11 min-h-touch text-muted hover:text-white transition -translate-y-1/2"
      :aria-label="visible ? $t('auth.form.hidePassword') : $t('auth.form.showPassword')"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <EyeIcon
        v-if="visible"
        cls="h-5 w-5 cursor-pointer"
      />
      <EyeSlashIcon
        v-else
        cls="h-5 w-5 cursor-pointer"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import EyeIcon from '@/components/icons/EyeIcon.vue'
import EyeSlashIcon from '@/components/icons/EyeSlashIcon.vue'

withDefaults(
  defineProps<{
    id: string
    modelValue: string
    autocomplete: string
    placeholder?: string
    name?: string
    disabled?: boolean
    required?: boolean
    invalid?: boolean
    describedby?: string | undefined
    minlength?: number | undefined
    maxlength?: number | undefined
  }>(),
  {
    placeholder: '',
    name: '',
    disabled: false,
    required: false,
    invalid: false,
    describedby: undefined,
    minlength: undefined,
    maxlength: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const visible = ref(false)

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>
