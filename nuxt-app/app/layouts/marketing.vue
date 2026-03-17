<script setup lang="ts">
const route = useRoute()
useLenis()
</script>

<template>
  <div class="min-h-screen bg-surface-base text-text-base">
    <!-- Skip link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-accent-violet focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>

    <MarketingCustomCursor />
    <MarketingNoiseOverlay />
    <MarketingNav />

    <AnimatePresence mode="wait">
      <motion
        :key="route.path"
        as="main"
        :initial="{ opacity: 0, y: 20 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -20 }"
        :transition="{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }"
      >
        <slot />
      </motion>
    </AnimatePresence>
  </div>
</template>
