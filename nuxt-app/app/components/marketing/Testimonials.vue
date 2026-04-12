<script setup lang="ts">
const testimonials = [
  {
    quote: 'Within a week of adding Eoni, our AI chat widget was answering 60% of customer questions automatically. The setup was incredibly simple.',
    name: 'Marie Laurent',
    role: 'CEO, Odysway',
    initials: 'ML'
  },
  {
    quote: 'Our products now show up in ChatGPT and Perplexity answers. That visibility alone has driven a 25% increase in organic traffic.',
    name: 'James Chen',
    role: 'Head of Digital, Pacific Trails',
    initials: 'JC'
  },
  {
    quote: 'The analytics dashboard showed us exactly what customers were asking. We used that data to improve our product descriptions and saw conversions jump.',
    name: 'Sofia Reyes',
    role: 'Marketing Director, Casa Bonita Hotels',
    initials: 'SR'
  }
]
</script>

<template>
  <section class="py-32">
    <div class="mx-auto max-w-6xl px-6">
      <span class="text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan mb-4 block text-center">
        Testimonials
      </span>
      <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance text-center mb-16">
        Loved by forward-thinking merchants
      </h2>

      <motion
        as="div"
        class="grid grid-cols-1 md:grid-cols-3 gap-6"
        :initial="'hidden'"
        :while-in-view="'visible'"
        :viewport="{ once: true, amount: 0.2 }"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }"
      >
        <motion
          v-for="(t, i) in testimonials"
          :key="i"
          as="blockquote"
          class="glass rounded-2xl p-6 flex flex-col"
          :variants="{
            hidden: { opacity: 0, y: 24 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
          }"
        >
          <UIcon
            name="i-lucide-quote"
            class="w-6 h-6 text-accent-violet/40 mb-4"
          />
          <p class="text-sm text-text-base leading-relaxed flex-1">
            {{ t.quote }}
          </p>
          <footer class="mt-6 flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-surface-3 border border-border-base flex items-center justify-center">
              <span class="text-xs font-mono font-medium text-text-muted">{{ t.initials }}</span>
            </div>
            <div>
              <cite class="not-italic text-sm font-medium text-text-base block">{{ t.name }}</cite>
              <span class="text-xs text-text-muted">{{ t.role }}</span>
            </div>
          </footer>
        </motion>
      </motion>
    </div>
  </section>
</template>
