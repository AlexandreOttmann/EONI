<script setup lang="ts">
import type { AnalyticsResponse } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Overview' })

interface StatCard {
  label: string
  value: number
  icon: string
}

const { isLoading: configLoading } = useMerchantConfig()
const { jobHistory, loadHistory } = useCrawl()
const { data: analytics, status: analyticsStatus } = useFetch<AnalyticsResponse>('/api/merchant/analytics')

const isLoading = computed(() => configLoading.value || analyticsStatus.value === 'pending')

onMounted(() => {
  loadHistory()
})

const pagesCrawled = computed(() =>
  jobHistory.value.filter(j => j.status === 'completed').reduce((sum, j) => sum + j.pages_crawled, 0)
)
const chunksIndexed = computed(() =>
  jobHistory.value.filter(j => j.status === 'completed').reduce((sum, j) => sum + j.chunks_created, 0)
)
const conversations = computed(() => analytics.value?.total_conversations ?? 0)
const isLive = computed(() => jobHistory.value.some(j => j.status === 'completed'))

const stats = computed<StatCard[]>(() => [
  { label: 'Pages crawled', value: pagesCrawled.value, icon: 'i-heroicons-document-text' },
  { label: 'Chunks indexed', value: chunksIndexed.value, icon: 'i-heroicons-cube' },
  { label: 'Conversations', value: conversations.value, icon: 'i-heroicons-chat-bubble-left-right' },
  { label: 'Status', value: isLive.value ? 1 : 0, icon: 'i-heroicons-signal' }
])

const countUp0 = useCountUp(computed(() => stats.value[0]?.value ?? 0))
const countUp1 = useCountUp(computed(() => stats.value[1]?.value ?? 0))
const countUp2 = useCountUp(computed(() => stats.value[2]?.value ?? 0))
const animatedValues = computed(() => [countUp0, countUp1, countUp2])

const recentCrawls = computed(() => jobHistory.value.slice(0, 5))
const topQuestions = computed(() => analytics.value?.top_questions ?? [])
const hasData = computed(() => jobHistory.value.length > 0)

const crawlColumns = [
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'pages_crawled', header: 'Pages' },
  { accessorKey: 'started_at', header: 'Started' }
]

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  return new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(dateStr))
}

function statusColor(status: string) {
  const map: Record<string, 'success' | 'primary' | 'neutral'> = {
    completed: 'success',
    running: 'primary',
    pending: 'neutral',
    failed: 'error' as 'success'
  }
  return map[status] ?? 'neutral'
}
</script>

<template>
  <div>
    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6"
      style="text-wrap: balance"
    >
      Overview
    </h1>

    <!-- Skeleton loading state -->
    <template v-if="isLoading">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <UCard
          v-for="i in 4"
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

    <!-- Stat cards -->
    <template v-else-if="hasData">
      <motion
        as="div"
        class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
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
            <!-- Hover glow -->
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

              <!-- Animated count-up value -->
              <p
                class="text-2xl font-display font-semibold tabular-nums text-text-base"
                :aria-label="`${stat.label}: ${stat.value}`"
              >
                {{ stat.label === 'Status' ? (stat.value ? 'Live' : 'Offline') : animatedValues[index]?.value ?? stat.value }}
              </p>
            </div>
          </UCard>
        </motion>
      </motion>

      <!-- Recent activity tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <h2 class="text-sm font-medium text-text-base">
              Recent Crawls
            </h2>
          </template>
          <UTable
            :data="recentCrawls"
            :columns="crawlColumns"
          >
            <template #url-cell="{ row }">
              <span class="max-w-xs truncate block text-sm font-mono">{{ row.original.url }}</span>
            </template>
            <template #status-cell="{ row }">
              <UBadge
                :color="statusColor(row.original.status)"
                variant="subtle"
                size="xs"
              >
                {{ row.original.status }}
              </UBadge>
            </template>
            <template #pages_crawled-cell="{ row }">
              <span class="tabular-nums">{{ row.original.pages_crawled }}</span>
            </template>
            <template #started_at-cell="{ row }">
              <span class="text-text-muted text-xs">{{ formatDate(row.original.started_at) }}</span>
            </template>
          </UTable>
        </UCard>
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

    <!-- Empty state -->
    <template v-else>
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="relative mb-6">
          <div
            class="absolute inset-0 rounded-full blur-xl opacity-30"
            style="background: radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)"
            aria-hidden="true"
          />
          <div class="relative w-14 h-14 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <UIcon
              name="i-heroicons-arrow-path"
              class="w-6 h-6 text-accent-violet"
            />
          </div>
        </div>
        <h3 class="text-base font-display font-medium text-text-base mb-1">
          No crawls yet
        </h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Add your store URL to start indexing your products for AI search.
        </p>
        <UButton
          label="Start your first crawl"
          to="/dashboard/crawl"
          color="primary"
          size="md"
        />
      </div>
    </template>
  </div>
</template>
