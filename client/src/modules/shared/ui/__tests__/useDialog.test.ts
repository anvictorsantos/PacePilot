/**
 * The Dialog module owns the keyboard and focus rules that both modals used to
 * hand-roll. Those rules are DOM work, so the test supplies the small slice of
 * the DOM they touch — the module itself takes no test-only seam for it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { useDialog } from '@/modules/shared/ui/useDialog.ts'

interface StubElement {
  focus: ReturnType<typeof vi.fn>
  hasAttribute: () => boolean
  offsetParent: object
}

function element(): StubElement {
  return {
    focus: vi.fn(),
    hasAttribute: () => false,
    offsetParent: {},
  }
}

const listeners = new Map<string, (_event: KeyboardEvent) => void>()

function installDom() {
  const body = { style: { overflow: '' } }
  const documentStub = {
    body,
    activeElement: null as unknown,
    addEventListener: (_type: string, handler: (_event: KeyboardEvent) => void) => {
      listeners.set(_type, handler)
    },
    removeEventListener: (_type: string) => {
      listeners.delete(_type)
    },
  }
  vi.stubGlobal('document', documentStub)
  return { body, documentStub }
}

function keydown(key: string, shiftKey = false) {
  const event = { key, shiftKey, preventDefault: vi.fn() } as unknown as KeyboardEvent
  listeners.get('keydown')?.(event)
  return event
}

describe('useDialog', () => {
  let body: { style: { overflow: string } }
  let documentStub: { activeElement: unknown }

  beforeEach(() => {
    const dom = installDom()
    body = dom.body
    documentStub = dom.documentStub
    listeners.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('names the dialog for assistive tech', () => {
    const { attrs } = useDialog(ref(null), {
      active: ref(false),
      labelledby: 'legal-title',
    })
    expect(attrs.value).toEqual({
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'legal-title',
    })
  })

  it('falls back to a label when there is no title element', () => {
    const { attrs } = useDialog(ref(null), { active: ref(false), label: 'Notifications' })
    expect(attrs.value['aria-label']).toBe('Notifications')
    expect(attrs.value['aria-labelledby']).toBeUndefined()
  })

  it('locks the page scroll while open and restores it on close', async () => {
    const active = ref(false)
    useDialog(ref(null), { active })
    expect(body.style.overflow).toBe('')

    active.value = true
    await nextTick()
    expect(body.style.overflow).toBe('hidden')

    active.value = false
    await nextTick()
    expect(body.style.overflow).toBe('')
  })

  it('closes on Escape', async () => {
    const onEscape = vi.fn()
    const active = ref(false)
    useDialog(ref(null), { active, onEscape })
    active.value = true
    await nextTick()

    keydown('Escape')

    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('wraps Tab at the end of the dialog and Shift+Tab at the start', async () => {
    const first = element()
    const last = element()
    const container = ref({
      querySelectorAll: () => [first, last],
    } as unknown as HTMLElement)
    const active = ref(false)
    useDialog(container, { active })
    active.value = true
    await nextTick()

    documentStub.activeElement = last
    const forward = keydown('Tab')
    expect(forward.preventDefault).toHaveBeenCalled()
    expect(first.focus).toHaveBeenCalled()

    documentStub.activeElement = first
    const backward = keydown('Tab', true)
    expect(backward.preventDefault).toHaveBeenCalled()
    expect(last.focus).toHaveBeenCalled()
  })

  it('focuses the first focusable element on open, or the one it was given', async () => {
    const first = element()
    const chosen = element()
    const container = ref({
      querySelectorAll: () => [first, chosen],
    } as unknown as HTMLElement)
    const initialFocus = ref(chosen as unknown as HTMLElement)
    const active = ref(false)
    useDialog(container, { active, initialFocus })
    active.value = true
    await nextTick()
    await nextTick()

    expect(chosen.focus).toHaveBeenCalled()
    expect(first.focus).not.toHaveBeenCalled()
  })

  it('restores focus to whatever was focused before it opened', async () => {
    const trigger = element()
    documentStub.activeElement = trigger
    const active = ref(false)
    useDialog(ref(null), { active })

    active.value = true
    await nextTick()
    active.value = false
    await nextTick()

    expect(trigger.focus).toHaveBeenCalled()
  })

  it('stops listening for keys once closed', async () => {
    const onEscape = vi.fn()
    const active = ref(false)
    useDialog(ref(null), { active, onEscape })
    active.value = true
    await nextTick()
    active.value = false
    await nextTick()

    keydown('Escape')

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('takes its active flag as a getter, so a computed works', async () => {
    const show = ref(false)
    useDialog(ref(null), { active: computed(() => show.value) })
    show.value = true
    await nextTick()
    expect(body.style.overflow).toBe('hidden')
  })
})
