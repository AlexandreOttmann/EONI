<script setup lang="ts">
const sectionRef = ref<HTMLElement | null>(null)
useReveal(sectionRef, 0)

const logos = [
  'Odysway',
  'Pacific Trails',
  'Casa Bonita',
  'Wanderlust Co.',
  'Alpine Gear',
  'Riviera Stays',
  'Nomad Market',
  'Solstice Travel',
] as const
</script>

<template>
  <section ref="sectionRef" class="border-y border-border-base py-20">
    <p class="mb-10 text-center text-xs font-mono uppercase tracking-[0.2em] text-text-subtle">
      Trusted by forward-thinking merchants
    </p>

    <div class="relative overflow-hidden">
      <!-- Fade edges -->
      <div
        class="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-surface-base to-transparent"
        aria-hidden="true"
      />
      <div
        class="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-surface-base to-transparent"
        aria-hidden="true"
      />

      <!-- Scrolling track -->
      <div class="flex gap-16 animate-logo-scroll">
        <!-- First set -->
        <div v-for="logo in logos" :key="logo" class="flex flex-shrink-0 items-center">
          <span class="whitespace-nowrap text-lg font-display font-medium text-text-base opacity-40 transition-opacity duration-300 hover:opacity-70">
            {{ logo }}
          </span>
        </div>
        <!-- Duplicate set for seamless loop -->
        <div
          v-for="logo in logos"
          :key="`dup-${logo}`"
          class="flex flex-shrink-0 items-center"
          aria-hidden="true"
        >
          <span class="whitespace-nowrap text-lg font-display font-medium text-text-base opacity-40 transition-opacity duration-300 hover:opacity-70">
            {{ logo }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
