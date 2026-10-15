import { computed } from 'vue'

export function useProgressBar(
  value: Ref<number>,
  options: { min?: number; max?: number; label: string | Ref<string> } = { min: 0, max: 100 }
) {
  const { min = 0, max = 100, label } = options

  return computed(() => ({
    role: 'progressbar',
    'aria-valuenow': Math.min(max, Math.max(min, value.value)),
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-label': typeof label === 'string' ? label : label.value,
  }))
}

export function useDialog(titleId: string) {
  return {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
  }
}

export function useMenu() {
  return { role: 'menu' }
}

export function useMenuItem() {
  return { role: 'menuitem' }
}

export function useListbox(labelledby: string) {
  return {
    role: 'listbox',
    'aria-labelledby': labelledby,
  }
}

export function useOption(selected: boolean, id?: string) {
  return {
    role: 'option',
    'aria-selected': selected,
    id,
  }
}

export function useAlert(live: 'polite' | 'assertive' = 'assertive') {
  return { role: 'alert', 'aria-live': live }
}

export function useLiveRegion(live: 'polite' | 'assertive' = 'polite', label?: string) {
  return {
    role: 'region',
    'aria-live': live,
    ...(label ? { 'aria-label': label } : {}),
  }
}

export function useButton(pressed?: boolean, expanded?: boolean, controls?: string) {
  return {
    role: 'button',
    ...(pressed !== undefined ? { 'aria-pressed': pressed } : {}),
    ...(expanded !== undefined ? { 'aria-expanded': expanded } : {}),
    ...(controls ? { 'aria-controls': controls } : {}),
  }
}

export function useLink(current?: boolean) {
  return {
    ...(current ? { 'aria-current': 'page' } : {}),
  }
}

export function useImg(label: string) {
  return { role: 'img', 'aria-label': label }
}

export function useHidden() {
  return { 'aria-hidden': 'true' }
}

export function useDescribedBy(...ids: (string | undefined)[]) {
  const validIds = ids.filter((id): id is string => !!id)
  if (!validIds.length) return {}
  return { 'aria-describedby': validIds.join(' ') }
}

export function useLabelledBy(...ids: (string | undefined)[]) {
  const validIds = ids.filter((id): id is string => !!id)
  if (!validIds.length) return {}
  return { 'aria-labelledby': validIds.join(' ') }
}