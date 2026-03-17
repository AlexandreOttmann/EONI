<script setup lang="ts">
interface Feature {
  title: string
  description: string
  icon: string
  tag: string | null
  span: string
}

const features: Feature[] = [
  {
    title: 'AI Chat Widget',
    description: 'A RAG-powered assistant that knows your entire catalog. Answers questions, recommends products, and captures leads — all from a single script tag.',
    icon: 'i-lucide-message-square',
    tag: 'Core',
    span: 'md:col-span-2'
  },
  {
    title: 'Smart Crawling',
    description: 'Paste a URL and our crawler discovers every product, service, and page. Automatic re-crawling keeps your AI up to date.',
    icon: 'i-lucide-scan-search',
    tag: null,
    span: ''
  },
  {
    title: 'LLM-Optimized Pages',
    description: 'Auto-generated static pages structured for AI consumption. Your products show up in ChatGPT, Perplexity, and Claude answers.',
    icon: 'i-lucide-file-code-2',
    tag: 'Phase 2',
    span: ''
  },
  {
    title: 'MCP Endpoint',
    description: 'A per-merchant API endpoint that lets any AI agent browse, search, and query your catalog programmatically.',
    icon: 'i-lucide-plug',
    tag: 'Phase 2',
    span: 'md:col-span-2'
  },
  {
    title: 'Analytics Dashboard',
    description: 'Track conversations, top questions, no-answer rates, and booking intents. Understand what your customers are really asking.',
    icon: 'i-lucide-bar-chart-3',
    tag: null,
    span: 'md:col-span-2'
  },
  {
    title: 'Webhook Automation',
    description: 'Events like lead_detected and booking_intent fire webhooks to your CRM, email platform, or custom backend.',
    icon: 'i-lucide-webhook',
    tag: 'Phase 3',
    span: ''
  }
]

const sectionRef = ref<HTMLElement | null>(null)

function onMouseMove(event: MouseEvent, cardEl: EventTarget | null) {
  const el = cardEl as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}
</script>

<template>
  <section
    id="features"
    ref="sectionRef"
    class="py-32"
  >
    <div class="mx-auto max-w-6xl px-6">
      <!-- Header -->
      <div class="mb-16 text-center">
        <span class="mb-4 block text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan">
          Features
        </span>
        <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance">
          Everything you need to sell with AI
        </h2>
      </div>

      <!-- Bento grid -->
      <motion
        as="div"
        class="grid grid-cols-1 gap-4 md:grid-cols-3"
        :initial="'hidden'"
        :while-in-view="'visible'"
        :viewport="{ once: true, amount: 0.2 }"
        :variants="{
          hidden: {},
          visible: { transition: { staggerChildren: 0.07 } }
        }"
      >
        <motion
          v-for="feature in features"
          :key="feature.title"
          as="div"
          :class="['group relative overflow-hidden rounded-2xl border border-border-base bg-surface-2 p-6 transition-colors duration-300 hover:border-accent-violet/30', feature.span]"
          :variants="{
            hidden: { opacity: 0, y: 24, scale: 0.97 },
            visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
          }"
          @mousemove="onMouseMove($event, $event.currentTarget)"
        >
          <!-- Mouse-follow glow -->
          <div
            class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style="background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(124,58,237,0.06), transparent 40%)"
            aria-hidden="true"
          />

          <!-- Content -->
          <div class="relative z-10">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-base bg-surface-3">
                <UIcon
                  :name="feature.icon"
                  class="h-5 w-5 text-accent-violet"
                />
              </div>
              <span
                v-if="feature.tag"
                class="rounded-full border border-accent-cyan/20 bg-accent-cyan/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] text-accent-cyan"
              >
                {{ feature.tag }}
              </span>
            </div>
            <h3 class="mb-2 text-base font-display font-medium text-text-base">
              {{ feature.title }}
            </h3>
            <p class="text-sm leading-relaxed text-text-muted">
              {{ feature.description }}
            </p>
          </div>
        </motion>
      </motion>
    </div>
  </section>
</template>
