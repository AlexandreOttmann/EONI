import { WidgetHost } from './widget'

// CRITICAL: capture currentScript synchronously BEFORE the IIFE.
// It becomes null after any async work or after the script finishes executing.
const _scriptEl = document.currentScript as HTMLScriptElement | null

;(function init() {
  const src = _scriptEl?.src ?? ''
  const apiBase = src ? new URL(src).origin : window.location.origin

  const widgetKey = _scriptEl?.dataset['key'] ?? ''
  const color = _scriptEl?.dataset['color'] ?? '#7c3aed'
  const position = (_scriptEl?.dataset['position'] ?? 'bottom-right') as 'bottom-right' | 'bottom-left'

  if (!widgetKey) {
    console.warn('[Eoni] data-key attribute is required')
    return
  }

  // Double-init guard
  if ((window as Record<string, unknown>).__eoniWidget) return
  ;(window as Record<string, unknown>).__eoniWidget = true

  function mount() {
    new WidgetHost({ apiBase, widgetKey, color, position }).mount()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }
})()
