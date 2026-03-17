<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Analytics'
})

interface StatCard {
  label: string
  value: number
  icon: string
  delta: string | null
  deltaPositive: boolean
  format?: 'number' | 'percent'
}

// TODO: Replace with real API call via useFetch('/api/merchant/analytics')
const isLoading = ref(true)

const dateRange = ref('7d')
const dateRangeOptions = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' }
]

const stats = ref<StatCard[]>([
  {
    label: 'Total conversations',
    value: 342,
    icon: 'i-heroicons-chat-bubble-left-right',
    delta: '+24%',
    deltaPositive: true,
    format: 'number'
  },
  {
    label: 'Avg confidence',
    value: 87,
    icon: 'i-heroicons-check-badge',
    delta: '+3%',
    deltaPositive: true,
    format: 'percent'
  },
  {
    label: 'No-answer rate',
    value: 14,
    icon: 'i-heroicons-question-mark-circle',
    delta: '-2%',
    deltaPositive: true,
    format: 'percent'
  }
])

const animatedValues = stats.value.map((stat) => {
  const target = ref(stat.value)
  return useCountUp(target)
})

function noAnswerBadgeColor(rate: number): 'error' | 'warning' | 'success' {
  if (rate > 20) return 'error'
  if (rate >= 10) return 'warning'
  return 'success'
}

// TODO: Replace with real data from useFetch('/api/merchant/analytics')
const topQuestions = ref([
  { content: 'Do you offer free shipping?', count: 45, avgConfidence: 0.92 },
  { content: 'What are your return policies?', count: 38, avgConfidence: 0.88 },
  { content: 'Do you have this in size large?', count: 31, avgConfidence: 0.85 },
  { content: 'When will my order arrive?', count: 27, avgConfidence: 0.91 },
  { content: 'Can I track my package?', count: 22, avgConfidence: 0.94 }
])

const unansweredQuestions = ref([
  { content: 'Do you ship to Antarctica?', count: 8, avgConfidence: 0.23 },
  { content: 'Can I pay with cryptocurrency?', count: 5, avgConfidence: 0.18 },
  { content: 'What is your CEO\'s favorite color?', count: 3, avgConfidence: 0.12 }
])

const topQuestionsColumns = [
  { accessorKey: 'content', header: 'Question' },
  { accessorKey: 'count', header: 'Count' },
  { accessorKey: 'avgConfidence', header: 'Avg Confidence' }
]

const unansweredColumns = [
  { accessorKey: 'content', header: 'Question' },
  { accessorKey: 'count', header: 'Count' },
  { accessorKey: 'avgConfidence', header: 'Avg Confidence' }
]

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function onMouseMove(event: MouseEvent, cardEl: EventTarget | null) {
  const el = cardEl as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}

onMounted(() => {
  setTimeout(() => {
    isLoading.value = false
  }, 600)
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <h1 class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base" style="text-wrap: balance">
        Analytics
      </h1>
      <USelect
        v-model="dateRange"
        :items="dateRangeOptions"
        size="sm"
        aria-label="Date range"
      />
    </div>

    <!-- Skeleton loading -->
    <template v-if="isLoading">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <UCard v-for="i in 3" :key="i">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <motion as="div"
                class="h-3 w-16 rounded bg-surface-3"
                :animate="{ opacity: [0.4, 1, 0.4] }"
                :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
              />
              <motion as="div"
                class="h-7 w-7 rounded-lg bg-surface-3"
                :animate="{ opacity: [0.4, 1, 0.4] }"
                :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
              />
            </div>
            <motion as="div"
              class="h-7 w-20 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.2 }"
            />
          </div>
        </UCard>
      </div>
    </template>

    <template v-else>
      <!-- Stat cards -->
      <motion as="div"
        class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
        }"
        initial="hidden"
        animate="visible"
      >
        <motion as="div"
          v-for="(stat, index) in stats"
          :key="stat.label"
          :variants="{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
          }"
          @mousemove="onMouseMove($event, $event.currentTarget)"
        >
          <UCard
            class="group relative overflow-hidden transition-shadow duration-300 hover:glow-violet"
          >
            <div
              class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style="background: radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(124,58,237,0.06), transparent 40%)"
              aria-hidden="true"
            />
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
                  {{ stat.label }}
                </span>
                <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-violet/10">
                  <UIcon :name="stat.icon" class="w-3.5 h-3.5 text-accent-violet" />
                </div>
              </div>
              <p
                class="text-2xl font-display font-semibold tabular-nums text-text-base"
                :aria-label="`${stat.label}: ${stat.format === 'percent' ? stat.value + '%' : stat.value}`"
              >
                {{ animatedValues[index]?.value ?? stat.value }}{{ stat.format === 'percent' ? '%' : '' }}
              </p>
              <div v-if="stat.delta" class="mt-2 flex items-center">
                <span
                  class="inline-flex items-center gap-1 text-xs font-mono tabular-nums"
                  :class="stat.deltaPositive ? 'text-success' : 'text-error'"
                >
                  <UIcon
                    :name="stat.deltaPositive ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'"
                    class="w-3 h-3"
                    aria-hidden="true"
                  />
                  {{ stat.delta }}
                </span>
                <UBadge
                  v-if="stat.label === 'No-answer rate'"
                  :color="noAnswerBadgeColor(stat.value)"
                  variant="subtle"
                  size="xs"
                  class="ml-2"
                  :aria-label="`No-answer rate: ${stat.value}%`"
                >
                  {{ stat.value > 20 ? 'High' : stat.value >= 10 ? 'Moderate' : 'Good' }}
                </UBadge>
              </div>
            </div>
          </UCard>
        </motion>
      </motion>

      <!-- Tables -->
      <div class="space-y-6">
        <!-- Top Questions -->
        <UCard>
          <template #header>
            <h2 class="text-sm font-medium text-text-base">Top Questions</h2>
          </template>
          <UTable
            v-if="topQuestions.length > 0"
            :data="topQuestions"
            :columns="topQuestionsColumns"
          >
            <template #content-cell="{ row }">
              <span class="text-sm text-text-base">{{ row.original.content }}</span>
            </template>
            <template #count-cell="{ row }">
              <span class="tabular-nums text-sm">{{ row.original.count }}</span>
            </template>
            <template #avgConfidence-cell="{ row }">
              <span class="tabular-nums text-sm text-text-muted">{{ formatPercent(row.original.avgConfidence) }}</span>
            </template>
          </UTable>
          <div v-else class="py-8 text-center text-sm text-text-muted">
            No questions recorded yet.
          </div>
        </UCard>

        <!-- Unanswered Questions -->
        <UCard>
          <template #header>
            <h2 class="text-sm font-medium text-text-base">Unanswered Questions</h2>
          </template>
          <UTable
            v-if="unansweredQuestions.length > 0"
            :data="unansweredQuestions"
            :columns="unansweredColumns"
          >
            <template #content-cell="{ row }">
              <span class="text-sm text-text-base">{{ row.original.content }}</span>
            </template>
            <template #count-cell="{ row }">
              <span class="tabular-nums text-sm">{{ row.original.count }}</span>
            </template>
            <template #avgConfidence-cell="{ row }">
              <UBadge :color="noAnswerBadgeColor(100 - row.original.avgConfidence * 100)" variant="subtle" size="xs">
                {{ formatPercent(row.original.avgConfidence) }}
              </UBadge>
            </template>
          </UTable>
          <div v-else class="py-8 text-center text-sm text-text-muted">
            No unanswered questions recorded yet.
          </div>
        </UCard>
      </div>
    </template>
  </div>
</template>
