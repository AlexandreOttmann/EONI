<script setup lang="ts">
import type { CrawlJob, Conversation } from '~/types/api'

definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Overview'
})

interface StatCard {
  label: string
  value: number
  icon: string
  delta: string | null
  deltaPositive: boolean
  sparkline: string | null
}

// TODO: Replace with real API calls via useFetch('/api/merchant/stats')
const isLoading = ref(true)

const stats = ref<StatCard[]>([
  {
    label: 'Pages crawled',
    value: 1204,
    icon: 'i-heroicons-document-text',
    delta: '+12%',
    deltaPositive: true,
    sparkline: '0,12 8,10 16,14 24,6 32,8 40,4 48,2'
  },
  {
    label: 'Chunks indexed',
    value: 8432,
    icon: 'i-heroicons-cube',
    delta: '+8%',
    deltaPositive: true,
    sparkline: '0,14 8,12 16,10 24,8 32,6 40,4 48,3'
  },
  {
    label: 'Conversations',
    value: 342,
    icon: 'i-heroicons-chat-bubble-left-right',
    delta: '+24%',
    deltaPositive: true,
    sparkline: '0,14 8,12 16,8 24,10 32,4 40,6 48,2'
  },
  {
    label: 'Status',
    value: 1,
    icon: 'i-heroicons-signal',
    delta: null,
    deltaPositive: true,
    sparkline: null
  }
])

// Animated count-up values
const animatedValues = stats.value.map((stat) => {
  const target = ref(stat.value)
  return useCountUp(target)
})

// TODO: Replace with real data from useFetch('/api/crawl/jobs')
const recentCrawls = ref<CrawlJob[]>([
  {
    id: '1',
    merchant_id: 'm1',
    url: 'https://example-store.com',
    status: 'completed',
    pages_found: 120,
    pages_crawled: 120,
    chunks_created: 842,
    error: null,
    started_at: '2026-03-16T10:00:00Z',
    completed_at: '2026-03-16T10:15:00Z',
    created_at: '2026-03-16T10:00:00Z'
  },
  {
    id: '2',
    merchant_id: 'm1',
    url: 'https://another-shop.com',
    status: 'running',
    pages_found: 85,
    pages_crawled: 42,
    chunks_created: 294,
    error: null,
    started_at: '2026-03-17T08:30:00Z',
    completed_at: null,
    created_at: '2026-03-17T08:30:00Z'
  }
])

// TODO: Replace with real data from useFetch('/api/conversations')
const recentConversations = ref<Conversation[]>([
  {
    id: 'c1',
    merchant_id: 'm1',
    session_id: 's1',
    source: 'widget',
    created_at: '2026-03-17T09:15:00Z'
  },
  {
    id: 'c2',
    merchant_id: 'm1',
    session_id: 's2',
    source: 'dashboard_preview',
    created_at: '2026-03-17T08:45:00Z'
  }
])

const crawlColumns = [
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'pages_crawled', header: 'Pages' },
  { accessorKey: 'started_at', header: 'Started' }
]

const conversationColumns = [
  { accessorKey: 'session_id', header: 'Session' },
  { accessorKey: 'source', header: 'Source' },
  { accessorKey: 'created_at', header: 'Created' }
]

const hasData = computed(() => recentCrawls.value.length > 0)

function onMouseMove(event: MouseEvent, cardEl: EventTarget | null) {
  const el = cardEl as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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

// Simulate loading
onMounted(() => {
  setTimeout(() => {
    isLoading.value = false
  }, 800)
})
</script>

<template>
  <div>
    <h1 class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6" style="text-wrap: balance">
      Overview
    </h1>

    <!-- Skeleton loading state -->
    <template v-if="isLoading">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <UCard v-for="i in 4" :key="i">
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
            <motion
              as="div"
              class="h-3 w-12 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.3 }"
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
                  <UIcon :name="stat.icon" class="w-3.5 h-3.5 text-accent-violet" />
                </div>
              </div>

              <!-- Animated count-up value -->
              <p
                class="text-2xl font-display font-semibold tabular-nums text-text-base"
                :aria-label="`${stat.label}: ${stat.value}`"
              >
                {{ stat.label === 'Status' ? (stat.value ? 'Live' : 'Offline') : animatedValues[index]?.value ?? stat.value }}
              </p>

              <!-- Delta + sparkline row -->
              <div class="mt-2 flex items-center justify-between">
                <span
                  v-if="stat.delta"
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
                <!-- Mini sparkline -->
                <svg
                  v-if="stat.sparkline"
                  class="w-12 h-4 text-accent-violet/40"
                  viewBox="0 0 48 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    :points="stat.sparkline"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
          </UCard>
        </motion>
      </motion>

      <!-- Recent activity tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard>
          <template #header>
            <h2 class="text-sm font-medium text-text-base">Recent Crawls</h2>
          </template>
          <UTable :data="recentCrawls" :columns="crawlColumns">
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
            <h2 class="text-sm font-medium text-text-base">Recent Conversations</h2>
          </template>
          <UTable :data="recentConversations" :columns="conversationColumns">
            <template #session_id-cell="{ row }">
              <span class="text-sm font-mono text-text-muted">{{ row.original.session_id.slice(0, 8) }}</span>
            </template>
            <template #source-cell="{ row }">
              <UBadge variant="subtle" size="xs" color="neutral">
                {{ row.original.source }}
              </UBadge>
            </template>
            <template #created_at-cell="{ row }">
              <span class="text-text-muted text-xs">{{ formatDate(row.original.created_at) }}</span>
            </template>
          </UTable>
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
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-accent-violet" />
          </div>
        </div>
        <h3 class="text-base font-display font-medium text-text-base mb-1">No crawls yet</h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Add your store URL to start indexing your products for AI search.
        </p>
        <UButton label="Start your first crawl" to="/dashboard/crawl" color="primary" size="md" />
      </div>
    </template>
  </div>
</template>
