import { describe, it, expect } from 'vitest'

import { useToast } from '@/composables/useToast.ts'

describe('useToast', () => {
  it('show/dismiss', () => {
    const { show, dismiss, toasts } = useToast()
    const id = show('hello')
    expect(toasts.value.length).toBe(1)
    dismiss(id)
    expect(toasts.value.length).toBe(0)
  })
})
