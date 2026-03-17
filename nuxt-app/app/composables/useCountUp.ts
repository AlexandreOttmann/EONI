export function useCountUp(target: Ref<number>, duration = 600) {
  const display = ref(0)

  watch(target, (newVal) => {
    if (import.meta.server) {
      display.value = newVal
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      display.value = newVal
      return
    }
    const start = display.value
    const diff = newVal - start
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = Math.round(start + diff * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { immediate: true })

  return display
}
