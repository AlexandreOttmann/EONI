<script setup lang="ts">
const containerRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)

const panels = [
  {
    title: 'Live on your website',
    subtitle: 'Chat widget embedded in one line of code',
    icon: 'i-lucide-globe'
  },
  {
    title: 'Smart conversations',
    subtitle: 'RAG-powered answers grounded in your catalog',
    icon: 'i-lucide-message-square'
  },
  {
    title: 'Actionable analytics',
    subtitle: 'Understand what customers ask',
    icon: 'i-lucide-bar-chart-3'
  }
]

onMounted(() => {
  if (!containerRef.value || !trackRef.value) return

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  const isMobile = window.matchMedia('(max-width: 767px)').matches
  if (isMobile) return

  const { gsap } = useGsap()
  if (!gsap) return

  nextTick(() => {
    const track = trackRef.value!
    const totalWidth = track.scrollWidth - track.offsetWidth

    gsap.to(track, {
      x: -totalWidth,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.value,
        pin: true,
        scrub: 1,
        end: () => `+=${totalWidth}`,
        invalidateOnRefresh: true
      }
    })
  })
})
</script>

<template>
  <section id="product-showcase" class="py-32">
    <div class="mx-auto max-w-6xl px-6 mb-12">
      <span class="text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan mb-4 block">
        See it in action
      </span>
      <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance">
        Built for modern commerce
      </h2>
    </div>

    <div ref="containerRef" class="relative overflow-hidden">
      <div
        ref="trackRef"
        class="flex gap-8 px-6 will-change-transform md:flex-nowrap overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scrollbar-hide"
      >
        <div
          v-for="(panel, i) in panels"
          :key="i"
          class="flex-shrink-0 w-[85vw] md:w-[60vw] lg:w-[50vw] snap-center"
        >
          <div class="rounded-2xl bg-surface-2 border border-border-base overflow-hidden">
            <div class="px-6 py-4 border-b border-border-base flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-surface-3 border border-border-base flex items-center justify-center">
                <UIcon :name="panel.icon" class="w-5 h-5 text-accent-violet" />
              </div>
              <div>
                <p class="text-base font-display font-medium text-text-base">
                  {{ panel.title }}
                </p>
                <p class="text-xs text-text-muted">
                  {{ panel.subtitle }}
                </p>
              </div>
            </div>
            <div class="aspect-[16/10] bg-surface-1 flex items-center justify-center">
              <span class="text-text-subtle text-sm font-mono">Preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
