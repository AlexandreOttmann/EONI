<script setup lang="ts">
const cursorX = ref(-100)
const cursorY = ref(-100)
const isHovering = ref(false)
const isVisible = ref(false)

onMounted(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced || window.matchMedia('(pointer: coarse)').matches) return

  isVisible.value = true

  window.addEventListener('mousemove', (e: MouseEvent) => {
    cursorX.value = e.clientX
    cursorY.value = e.clientY
  })

  const observe = () => {
    document.querySelectorAll('a, button, [data-cursor="hover"]').forEach((el) => {
      el.addEventListener('mouseenter', () => { isHovering.value = true })
      el.addEventListener('mouseleave', () => { isHovering.value = false })
    })
  }

  observe()

  const observer = new MutationObserver(() => observe())
  observer.observe(document.body, { childList: true, subtree: true })

  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <motion
    v-if="isVisible"
    as="div"
    aria-hidden="true"
    class="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full border border-accent-violet mix-blend-difference"
    :animate="{
      x: cursorX - (isHovering ? 20 : 6),
      y: cursorY - (isHovering ? 20 : 6),
      width: isHovering ? '40px' : '12px',
      height: isHovering ? '40px' : '12px'
    }"
    :transition="{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }"
  />
</template>
