<script setup lang="ts">
const sectionRef = ref<HTMLElement | null>(null)

useReveal(sectionRef, 0)
</script>

<template>
  <section
    ref="sectionRef"
    class="py-32 relative overflow-hidden"
  >
    <!-- Decorative background -->
    <div
      class="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style="background: radial-gradient(ellipse 80% 50% at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 30% 80%, rgba(6,182,212,0.08) 0%, transparent 50%);"
    />

    <div class="relative z-10 mx-auto max-w-3xl px-6 text-center">
      <h2 class="text-[clamp(2rem,5vw,4rem)] font-display font-bold leading-[1.05] text-text-base text-balance mb-6">
        Ready to make your products visible to AI?
      </h2>
      <p class="text-lg text-text-muted mb-10 max-w-xl mx-auto">
        Set up in 5 minutes. No credit card required.
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <MarketingMagneticButton
          variant="primary"
          to="/auth/signup"
        >
          Get started free
          <UIcon
            name="i-lucide-arrow-right"
            class="w-4 h-4"
          />
        </MarketingMagneticButton>
        <MarketingMagneticButton
          variant="ghost"
          to="#pricing"
        >
          View pricing
        </MarketingMagneticButton>
      </div>
    </div>
  </section>
</template>
