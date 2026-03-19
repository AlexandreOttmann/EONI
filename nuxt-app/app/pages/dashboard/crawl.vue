<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Crawl'
})

const { activeJob: activeCrawlJob, jobHistory: crawlHistory, startCrawl, loadHistory } = useCrawl()

const crawlUrl = ref('')
const isSubmitting = ref(false)

async function handleStartCrawl() {
  if (!crawlUrl.value.trim()) return
  isSubmitting.value = true
  try {
    await startCrawl(crawlUrl.value.trim())
    crawlUrl.value = ''
  } finally {
    isSubmitting.value = false
  }
}

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

onMounted(loadHistory)
</script>

<template>
  <div>
    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-1"
      style="text-wrap: balance"
    >
      Crawl your store
    </h1>
    <p class="text-sm text-text-muted mb-6 leading-relaxed">
      Enter your store URL to crawl and index your products for AI-powered search.
    </p>

    <!-- URL input row -->
    <UCard class="mb-6">
      <form
        class="flex gap-3"
        @submit.prevent="handleStartCrawl"
      >
        <label
          for="crawl-url"
          class="sr-only"
        >Store URL</label>
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
    <div
      v-if="activeCrawlJob"
      class="mb-6"
    >
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
        <UTable
          :data="crawlHistory"
          :columns="historyColumns"
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
      <div
        v-else
        class="flex flex-col items-center justify-center py-16 text-center"
      >
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
          No crawl history
        </h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Start your first crawl by entering a URL above.
        </p>
      </div>
    </div>
  </div>
</template>
