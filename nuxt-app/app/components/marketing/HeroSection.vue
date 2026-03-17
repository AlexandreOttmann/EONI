<script setup lang="ts">
const { gsap } = useGsap()

const headingRef = ref<HTMLElement | null>(null)
const overlineRef = ref<HTMLElement | null>(null)
const subRef = ref<HTMLElement | null>(null)
const ctaRef = ref<HTMLElement | null>(null)
const mockupRef = ref<HTMLElement | null>(null)

useTextReveal(headingRef)
useReveal(subRef, 0.3)
useReveal(ctaRef, 0.5)

onMounted(() => {
  if (!gsap) return

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Overline entrance
  if (overlineRef.value && !prefersReduced) {
    gsap.from(overlineRef.value, {
      opacity: 0,
      y: 20,
      duration: 0.6,
      ease: 'power3.out',
      delay: 0.1,
    })
  }

  if (mockupRef.value) {
    if (!prefersReduced) {
      // Mockup entrance
      gsap.fromTo(
        mockupRef.value,
        { y: 80, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.6 },
      )

      // Mockup parallax
      gsap.to(mockupRef.value, {
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: mockupRef.value,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      })
    } else {
      // Reduced motion: simple fade only
      gsap.fromTo(
        mockupRef.value,
        { opacity: 0 },
        { opacity: 1, duration: 0.4 },
      )
    }
  }
})
</script>

<template>
  <section id="main-content" class="relative overflow-hidden">
    <!-- Background mesh -->
    <div class="absolute inset-0 hero-mesh hero-mesh-animated" aria-hidden="true" />

    <!-- Content -->
    <div class="relative z-10 mx-auto max-w-5xl px-6 pt-40 pb-24 text-center">
      <!-- Overline -->
      <span
        ref="overlineRef"
        class="mb-6 inline-block text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan"
      >
        AI-powered storefronts
      </span>

      <!-- Heading -->
      <h1
        ref="headingRef"
        class="text-[clamp(2.5rem,7vw,5.5rem)] font-display font-bold leading-[0.95] tracking-tight text-text-base text-balance"
      >
        Turn any website into an
        <span class="gradient-text-violet-cyan">AI-powered</span>
        storefront
      </h1>

      <!-- Subheading -->
      <p
        ref="subRef"
        class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted text-pretty"
      >
        Paste your URL. Our AI crawls your catalog, builds a smart chat widget,
        and makes your products discoverable by ChatGPT, Perplexity, and Claude.
        Live in 5&nbsp;minutes.
      </p>

      <!-- CTAs -->
      <div ref="ctaRef" class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <MarketingMagneticButton variant="primary" to="/auth/login">
          Get started free
          <UIcon name="i-lucide-arrow-right" class="h-4 w-4" />
        </MarketingMagneticButton>
        <MarketingMagneticButton variant="ghost" to="#product-showcase">
          See it in action
          <UIcon name="i-lucide-play" class="h-4 w-4" />
        </MarketingMagneticButton>
      </div>

      <!-- Product mockup -->
      <div ref="mockupRef" class="relative mx-auto mt-20 max-w-4xl">
        <!-- Glow behind -->
        <div
          class="absolute -inset-4 rounded-3xl opacity-60 blur-3xl"
          style="background: radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, transparent 70%)"
          aria-hidden="true"
        />
        <!-- Browser frame -->
        <div class="relative overflow-hidden rounded-2xl border border-border-base bg-surface-1 glow-violet">
          <!-- Chrome bar -->
          <div class="flex items-center gap-2 border-b border-border-base bg-surface-2 px-4 py-3">
            <div class="flex gap-1.5" aria-hidden="true">
              <div class="h-3 w-3 rounded-full bg-surface-3" />
              <div class="h-3 w-3 rounded-full bg-surface-3" />
              <div class="h-3 w-3 rounded-full bg-surface-3" />
            </div>
            <div class="mx-8 flex-1">
              <div class="mx-auto flex h-6 max-w-xs items-center justify-center rounded-full bg-surface-3">
                <span class="text-[10px] font-mono text-text-subtle">yourtravelagency.com</span>
              </div>
            </div>
          </div>
          <!-- Screenshot placeholder -->
          <div class="flex aspect-[16/10] items-center justify-center bg-surface-2">
            <span class="text-sm font-mono text-text-subtle">Dashboard preview</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
