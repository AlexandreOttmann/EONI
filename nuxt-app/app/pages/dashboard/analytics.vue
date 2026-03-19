<script setup lang="ts">
import type { AnalyticsResponse } from '~/types/api'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Analytics' })

interface StatCard {
  label: string
  value: number
  icon: string
  format?: 'number' | 'percent'
}

const { data, status } = useFetch<AnalyticsResponse>('/api/merchant/analytics')
const isLoading = computed(() => status.value === 'pending')

const stats = computed<StatCard[]>(() => {
  if (!data.value) return []
  return [
    {
      label: 'Total conversations',
      value: data.value.total_conversations,
      icon: 'i-heroicons-chat-bubble-left-right',
      format: 'number'
    },
    {
      label: 'Total messages',
      value: data.value.total_messages,
      icon: 'i-heroicons-envelope',
      format: 'number'
    },
    {
      label: 'No-answer rate',
      value: Math.round(data.value.no_answer_rate * 100),
      icon: 'i-heroicons-question-mark-circle',
      format: 'percent'
    }
  ]
})

const topQuestions = computed(() => data.value?.top_questions ?? [])

const countUp0 = useCountUp(computed(() => stats.value[0]?.value ?? 0))
const countUp1 = useCountUp(computed(() => stats.value[1]?.value ?? 0))
const countUp2 = useCountUp(computed(() => stats.value[2]?.value ?? 0))
const animatedValues = computed(() => [countUp0, countUp1, countUp2])

function noAnswerBadgeColor(rate: number): 'error' | 'warning' | 'success' {
  if (rate > 20) return 'error'
  if (rate >= 10) return 'warning'
  return 'success'
}

const topQuestionsColumns = [
  { accessorKey: 'content', header: 'Question' },
  { accessorKey: 'count', header: 'Count' }
]

function onMouseMove(event: MouseEvent, cardEl: EventTarget | null) {
  const el = cardEl as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}
</script>

<template>
  <div>
    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6"
      style="text-wrap: balance"
    >
      Analytics
    </h1>

    <!-- Skeleton loading -->
    <template v-if="isLoading">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <UCard
          v-for="i in 3"
          :key="i"
        >
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <motion
                as="div"
                class="h-3 w-16 rounded bg-surface-3"
                :animate="{ opacity: [0.4, 1, 0.4] }"
                :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
              />
              <motion
                as="div"
                class="h-7 w-7 rounded-lg bg-surface-3"
                :animate="{ opacity: [0.4, 1, 0.4] }"
                :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
              />
            </div>
            <motion
              as="div"
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
      <motion
        as="div"
        class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
        }"
        initial="hidden"
        animate="visible"
      >
        <motion
          v-for="(stat, index) in stats"
          :key="stat.label"
          as="div"
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
                  <UIcon
                    :name="stat.icon"
                    class="w-3.5 h-3.5 text-accent-violet"
                  />
                </div>
              </div>
              <p
                class="text-2xl font-display font-semibold tabular-nums text-text-base"
                :aria-label="`${stat.label}: ${stat.format === 'percent' ? stat.value + '%' : stat.value}`"
              >
                {{ animatedValues[index]?.value ?? stat.value }}{{ stat.format === 'percent' ? '%' : '' }}
              </p>
              <div
                v-if="stat.label === 'No-answer rate'"
                class="mt-2"
              >
                <UBadge
                  :color="noAnswerBadgeColor(stat.value)"
                  variant="subtle"
                  size="xs"
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
            <h2 class="text-sm font-medium text-text-base">
              Top Questions
            </h2>
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
          </UTable>
          <div
            v-else
            class="py-8 text-center text-sm text-text-muted"
          >
            No questions recorded yet.
          </div>
        </UCard>
      </div>
    </template>
  </div>
</template>
