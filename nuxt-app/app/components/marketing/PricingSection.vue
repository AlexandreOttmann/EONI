<script setup lang="ts">
const isYearly = ref(false)

const plans = [
  {
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 23,
    description: 'Perfect for small stores getting started with AI.',
    features: [
      '1 website',
      '1,000 pages crawled',
      '5,000 chat messages/mo',
      'Basic analytics',
      'Email support'
    ],
    highlighted: false,
    cta: 'Start free trial'
  },
  {
    name: 'Pro',
    monthlyPrice: 79,
    yearlyPrice: 63,
    description: 'For growing businesses that need more power.',
    features: [
      '5 websites',
      '10,000 pages crawled',
      '50,000 chat messages/mo',
      'Advanced analytics',
      'LLM-optimized pages',
      'MCP endpoint',
      'Webhook automation',
      'Priority support'
    ],
    highlighted: true,
    cta: 'Start free trial'
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    description: 'Custom solutions for large-scale operations.',
    features: [
      'Unlimited websites',
      'Unlimited pages',
      'Unlimited messages',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated account manager',
      'On-premise option'
    ],
    highlighted: false,
    cta: 'Contact sales'
  }
]

function formatPrice(plan: typeof plans[0]) {
  if (plan.monthlyPrice === null) return 'Custom'
  return `$${isYearly.value ? plan.yearlyPrice : plan.monthlyPrice}`
}
</script>

<template>
  <section
    id="pricing"
    class="py-32"
  >
    <div class="mx-auto max-w-6xl px-6">
      <div class="text-center mb-16">
        <span class="text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan mb-4 block">
          Pricing
        </span>
        <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance mb-6">
          Simple, transparent pricing
        </h2>
        <p class="text-sm text-text-muted max-w-lg mx-auto mb-8">
          Start free, scale as you grow. No hidden fees.
        </p>

        <!-- Billing toggle -->
        <div class="flex items-center justify-center gap-3">
          <span
            class="text-sm"
            :class="isYearly ? 'text-text-muted' : 'text-text-base'"
          >Monthly</span>
          <button
            role="switch"
            :aria-checked="isYearly"
            aria-label="Toggle yearly billing"
            class="relative w-12 h-6 rounded-full bg-surface-3 border border-border-base transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none"
            :class="{ 'bg-accent-violet/20 border-accent-violet/50': isYearly }"
            @click="isYearly = !isYearly"
          >
            <motion
              as="div"
              class="absolute top-0.5 w-5 h-5 rounded-full bg-text-base"
              :animate="{ left: isYearly ? '26px' : '2px' }"
              :transition="{ type: 'spring', stiffness: 500, damping: 30 }"
            />
          </button>
          <span
            class="text-sm"
            :class="isYearly ? 'text-text-base' : 'text-text-muted'"
          >Yearly</span>
          <span
            v-if="isYearly"
            class="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-cyan px-2 py-0.5 rounded-full border border-accent-cyan/20 bg-accent-cyan/5"
          >
            Save 20%
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div
          v-for="(plan, i) in plans"
          :key="i"
          class="relative rounded-2xl p-8"
          :class="plan.highlighted
            ? 'bg-surface-2 border-2 border-accent-violet/50 glow-violet'
            : 'bg-surface-2 border border-border-base'"
        >
          <!-- Most popular badge -->
          <span
            v-if="plan.highlighted"
            class="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.15em] text-white bg-accent-violet px-3 py-1 rounded-full"
          >
            Most popular
          </span>

          <h3 class="text-lg font-display font-medium text-text-base mb-1">
            {{ plan.name }}
          </h3>
          <p class="text-xs text-text-muted mb-6">
            {{ plan.description }}
          </p>

          <div class="mb-6 h-12 flex items-baseline gap-1">
            <AnimatePresence mode="wait">
              <motion
                :key="`${plan.name}-${isYearly}`"
                as="span"
                class="text-4xl font-display font-bold text-text-base"
                :initial="{ y: 10, opacity: 0 }"
                :animate="{ y: 0, opacity: 1 }"
                :exit="{ y: -10, opacity: 0 }"
                :transition="{ duration: 0.2 }"
              >
                {{ formatPrice(plan) }}
              </motion>
            </AnimatePresence>
            <span
              v-if="plan.monthlyPrice !== null"
              class="text-sm text-text-muted"
            >/mo</span>
          </div>

          <UButton
            :label="plan.cta"
            :color="plan.highlighted ? 'violet' : 'neutral'"
            :variant="plan.highlighted ? 'solid' : 'outline'"
            block
            size="lg"
            class="mb-8"
          />

          <ul class="space-y-3">
            <li
              v-for="(feature, fi) in plan.features"
              :key="fi"
              class="flex items-start gap-2 text-sm text-text-muted"
            >
              <UIcon
                name="i-lucide-check"
                class="w-4 h-4 text-accent-violet shrink-0 mt-0.5"
              />
              {{ feature }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
