<script setup lang="ts">
import type { CrawlJob } from '~/types/api'

definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Crawl'
})

const crawlUrl = ref('')
const isSubmitting = ref(false)

// TODO: Replace with real API call via useFetch('/api/crawl/start')
async function startCrawl() {
  if (!crawlUrl.value.trim()) return
  isSubmitting.value = true
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  // TODO: POST /api/crawl/start { url: crawlUrl.value }
  // Then subscribe to crawl status via Supabase Realtime
  isSubmitting.value = false
  crawlUrl.value = ''
}

// TODO: Replace with real data from useCrawl() composable
const activeCrawlJob = ref<CrawlJob | null>({
  id: 'job-1',
  merchant_id: 'm1',
  url: 'https://example-store.com',
  status: 'running',
  pages_found: 85,
  pages_crawled: 42,
  chunks_created: 294,
  error: null,
  started_at: '2026-03-17T08:30:00Z',
  completed_at: null,
  created_at: '2026-03-17T08:30:00Z'
})

// TODO: Replace with real data from useFetch('/api/crawl/jobs')
const crawlHistory = ref<CrawlJob[]>([
  {
    id: 'job-2',
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
    id: 'job-3',
    merchant_id: 'm1',
    url: 'https://another-shop.com',
    status: 'failed',
    pages_found: 50,
    pages_crawled: 23,
    chunks_created: 0,
    error: 'Connection timeout after 30s',
    started_at: '2026-03-15T14:20:00Z',
    completed_at: '2026-03-15T14:25:00Z',
    created_at: '2026-03-15T14:20:00Z'
  }
])

const historyColumns = [
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'pages_crawled', header: 'Pages' },
  { accessorKey: 'chunks_created', header: 'Chunks' },
  { accessorKey: 'started_at', header: 'Started' }
]

const statusColor = (s: string) => ({
  pending: 'neutral' as const,
  running: 'primary' as const,
  completed: 'success' as const,
  failed: 'error' as const
})[s] ?? 'neutral' as const

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateStr))
}
</script>

<template>
  <div>
    <h1 class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-1" style="text-wrap: balance">
      Crawl your store
    </h1>
    <p class="text-sm text-text-muted mb-6 leading-relaxed">
      Enter your store URL to crawl and index your products for AI-powered search.
    </p>

    <!-- URL input row -->
    <UCard class="mb-6">
      <form class="flex gap-3" @submit.prevent="startCrawl">
        <label for="crawl-url" class="sr-only">Store URL</label>
        <UInput
          id="crawl-url"
          v-model="crawlUrl"
          placeholder="https://your-store.com"
          type="url"
          aria-label="Store URL"
          class="flex-1"
          size="md"
          :disabled="isSubmitting"
        />
        <UButton
          type="submit"
          label="Start Crawl"
          icon="i-heroicons-arrow-path"
          color="primary"
          size="md"
          :loading="isSubmitting"
          :disabled="!crawlUrl.trim() || isSubmitting"
        />
      </form>
    </UCard>

    <!-- Active crawl job -->
    <div v-if="activeCrawlJob" class="mb-6">
      <h2 class="text-[clamp(1.125rem,2vw,1.375rem)] font-display font-medium text-text-base mb-3">
        Active Crawl
      </h2>
      <DashboardCrawlProgressCard :job="activeCrawlJob" />
    </div>

    <!-- Crawl history -->
    <div>
      <h2 class="text-[clamp(1.125rem,2vw,1.375rem)] font-display font-medium text-text-base mb-3">
        Crawl History
      </h2>
      <UCard v-if="crawlHistory.length > 0">
        <UTable :data="crawlHistory" :columns="historyColumns">
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
            <span class="tabular-nums">{{ row.original.pages_crawled }}&nbsp;/&nbsp;{{ row.original.pages_found }}</span>
          </template>
          <template #chunks_created-cell="{ row }">
            <span class="tabular-nums">{{ row.original.chunks_created }}</span>
          </template>
          <template #started_at-cell="{ row }">
            <span class="text-text-muted text-xs">{{ formatDate(row.original.started_at) }}</span>
          </template>
        </UTable>
      </UCard>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
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
        <h3 class="text-base font-display font-medium text-text-base mb-1">No crawl history</h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Start your first crawl by entering a URL above.
        </p>
      </div>
    </div>
  </div>
</template>
