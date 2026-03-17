<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-surface-base flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Noise overlay -->
    <MarketingNoiseOverlay />

    <!-- Violet glow — top left -->
    <div
      class="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 pointer-events-none"
      aria-hidden="true"
      style="background: radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 70%); filter: blur(80px)"
    />
    <!-- Cyan glow — bottom right -->
    <div
      class="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 pointer-events-none"
      aria-hidden="true"
      style="background: radial-gradient(ellipse at center, rgba(6,182,212,0.10) 0%, transparent 70%); filter: blur(80px)"
    />

    <!-- Auth card slot -->
    <motion
      as="div"
      class="w-full max-w-sm relative z-10"
      :initial="{ opacity: 0, y: 16, scale: 0.98 }"
      :animate="{ opacity: 1, y: 0, scale: 1 }"
      :transition="{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }"
    >
      <slot />
    </motion>
  </div>
</template>
