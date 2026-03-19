<script setup lang="ts">
const { gsap } = useGsap()

const sectionRef = ref<HTMLElement | null>(null)
const connectorRef = ref<HTMLElement | null>(null)
const stepsRef = ref<HTMLElement[]>([])

interface Step {
  number: string
  icon: string
  title: string
  description: string
}

const steps: Step[] = [
  {
    number: '01',
    icon: 'i-lucide-link',
    title: 'Paste your URL',
    description: 'Enter your website address. Our crawler indexes every product, service, and page automatically.'
  },
  {
    number: '02',
    icon: 'i-lucide-brain',
    title: 'AI indexes your catalog',
    description: 'Content is chunked, embedded, and stored in a vector database. Your entire catalog becomes AI-searchable.'
  },
  {
    number: '03',
    icon: 'i-lucide-rocket',
    title: 'Go live in minutes',
    description: 'Add one script tag. Your AI chat widget is live, and your products appear in LLM answers.'
  }
]

onMounted(() => {
  if (!gsap) return

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // Connector line animation (desktop)
  if (connectorRef.value) {
    gsap.fromTo(
      connectorRef.value,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.2,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: sectionRef.value,
          start: 'top 75%',
          once: true
        }
      }
    )
  }

  // Steps stagger entrance
  if (stepsRef.value.length) {
    gsap.fromTo(
      stepsRef.value,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: {
          trigger: sectionRef.value,
          start: 'top 80%',
          once: true
        }
      }
    )
  }
})
</script>

<template>
  <section
    id="how-it-works"
    ref="sectionRef"
    class="py-32"
  >
    <div class="mx-auto max-w-6xl px-6">
      <!-- Header -->
      <div class="mb-16 text-center">
        <span class="mb-4 block text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan">
          How it works
        </span>
        <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance">
          Three steps to AI-ready commerce
        </h2>
      </div>

      <!-- Steps grid -->
      <div class="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
        <!-- Desktop connector line -->
        <div
          class="absolute left-[16.66%] right-[16.66%] top-16 hidden h-px md:block"
          aria-hidden="true"
        >
          <div
            ref="connectorRef"
            class="h-full origin-left scale-x-0 bg-gradient-to-r from-accent-violet via-accent-cyan to-accent-violet"
          />
        </div>

        <!-- Mobile connector line -->
        <div
          class="absolute bottom-8 left-6 top-8 w-px bg-gradient-to-b from-accent-violet via-accent-cyan to-accent-violet md:hidden"
          aria-hidden="true"
        />

        <!-- Step cards -->
        <div
          v-for="step in steps"
          :key="step.number"
          :ref="(el) => { if (el) stepsRef.push(el as HTMLElement) }"
          class="relative pl-10 md:pl-0 md:text-center"
        >
          <!-- Number badge -->
          <div class="mb-4 flex items-center justify-start md:justify-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full border border-border-base bg-surface-2">
              <span class="font-mono text-sm text-accent-violet">{{ step.number }}</span>
            </div>
          </div>

          <!-- Icon -->
          <div class="mb-4 flex items-center justify-start md:justify-center">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-base bg-surface-2">
              <UIcon
                :name="step.icon"
                class="h-5 w-5 text-accent-cyan"
              />
            </div>
          </div>

          <!-- Text -->
          <h3 class="mb-2 text-lg font-display font-medium text-text-base">
            {{ step.title }}
          </h3>
          <p class="max-w-xs text-sm leading-relaxed text-text-muted">
            {{ step.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
