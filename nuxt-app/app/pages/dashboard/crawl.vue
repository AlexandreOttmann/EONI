<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Crawl'
})

const {
  activeJob: activeCrawlJob,
  jobHistory: crawlHistory,
  startCrawl,
  loadHistory,
  // Discovery
  sitemapGroups,
  totalSitemapUrls,
  ungroupedCount,
  isDiscovering,
  discoverSite,
  resetDiscovery
} = useCrawl()

const crawlUrl = ref('')
const isSubmitting = ref(false)
const step = ref<'input' | 'configure'>('input')
const selectedGroups = ref<Set<string>>(new Set())
const pageLimit = ref(100)

async function handleDiscover() {
  if (!crawlUrl.value.trim()) return
  isSubmitting.value = true
  try {
    const result = await discoverSite(crawlUrl.value.trim())
    if (result.sitemap_found && result.groups.length > 0) {
      // Pre-select all groups
      selectedGroups.value = new Set(result.groups.map(g => g.pattern))
      step.value = 'configure'
    } else {
      // No sitemap — start crawl directly
      await startCrawl(crawlUrl.value.trim(), { limit: pageLimit.value })
      crawlUrl.value = ''
    }
  } catch {
    // Error handled by composable toast
  } finally {
    isSubmitting.value = false
  }
}

function toggleGroup(pattern: string) {
  const next = new Set(selectedGroups.value)
  if (next.has(pattern)) {
    next.delete(pattern)
  } else {
    next.add(pattern)
  }
  selectedGroups.value = next
}

function toggleAll() {
  if (selectedGroups.value.size === sitemapGroups.value.length) {
    selectedGroups.value = new Set()
  } else {
    selectedGroups.value = new Set(sitemapGroups.value.map(g => g.pattern))
  }
}

const selectedPageCount = computed(() => {
  return sitemapGroups.value
    .filter(g => selectedGroups.value.has(g.pattern))
    .reduce((sum, g) => sum + g.count, 0)
})

async function handleStartCrawl() {
  isSubmitting.value = true
  try {
    const includePatterns = selectedGroups.value.size > 0 && selectedGroups.value.size < sitemapGroups.value.length
      ? Array.from(selectedGroups.value)
      : undefined // All selected = no filter needed

    await startCrawl(crawlUrl.value.trim(), {
      limit: pageLimit.value,
      includePatterns
    })
    crawlUrl.value = ''
    step.value = 'input'
    resetDiscovery()
  } finally {
    isSubmitting.value = false
  }
}

function handleBack() {
  step.value = 'input'
  resetDiscovery()
}

async function handleSkipAndCrawl() {
  isSubmitting.value = true
  try {
    await startCrawl(crawlUrl.value.trim(), { limit: pageLimit.value })
    crawlUrl.value = ''
    step.value = 'input'
    resetDiscovery()
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

    <!-- Step 1: URL input -->
    <UCard
      v-if="step === 'input'"
      class="mb-6"
    >
      <form
        class="flex gap-3"
        @submit.prevent="handleDiscover"
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
          :disabled="isSubmitting || isDiscovering"
        />
        <UButton
          type="submit"
          label="Analyze Site"
          icon="i-heroicons-magnifying-glass"
          color="primary"
          size="md"
          :loading="isSubmitting || isDiscovering"
          :disabled="!crawlUrl.trim() || isSubmitting || isDiscovering"
        />
      </form>
    </UCard>

    <!-- Step 2: Site structure / configure -->
    <div
      v-if="step === 'configure'"
      class="mb-6 space-y-4"
    >
      <UCard>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-display font-medium text-text-base">
              Site Structure
            </h2>
            <p class="text-sm text-text-muted mt-0.5">
              {{ totalSitemapUrls }} URLs found in sitemap. Select which sections to crawl.
            </p>
          </div>
          <UButton
            variant="ghost"
            size="xs"
            icon="i-heroicons-arrow-left"
            label="Back"
            @click="handleBack"
          />
        </div>

        <!-- Select all toggle -->
        <div class="flex items-center justify-between mb-3 pb-3 border-b border-border-subtle">
          <button
            type="button"
            class="text-sm font-medium text-accent-violet hover:underline"
            @click="toggleAll"
          >
            {{ selectedGroups.size === sitemapGroups.length ? 'Deselect All' : 'Select All' }}
          </button>
          <span class="text-xs text-text-muted tabular-nums">
            {{ selectedPageCount }} pages selected
          </span>
        </div>

        <!-- Group list -->
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <button
            v-for="group in sitemapGroups"
            :key="group.pattern"
            type="button"
            class="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left"
            :class="selectedGroups.has(group.pattern)
              ? 'border-accent-violet/40 bg-accent-violet/5'
              : 'border-border-subtle hover:border-border-default'"
            @click="toggleGroup(group.pattern)"
          >
            <div
              class="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
              :class="selectedGroups.has(group.pattern)
                ? 'border-accent-violet bg-accent-violet'
                : 'border-border-default'"
            >
              <UIcon
                v-if="selectedGroups.has(group.pattern)"
                name="i-heroicons-check"
                class="w-3 h-3 text-white"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-text-base capitalize">{{ group.label }}</span>
                <UBadge
                  variant="subtle"
                  color="neutral"
                  size="xs"
                >
                  {{ group.count }} pages
                </UBadge>
              </div>
              <p class="text-xs text-text-muted mt-0.5 font-mono truncate">
                {{ group.pattern }}
              </p>
            </div>
          </button>
        </div>

        <!-- Ungrouped info -->
        <p
          v-if="ungroupedCount > 0"
          class="text-xs text-text-muted mt-3 pt-3 border-t border-border-subtle"
        >
          + {{ ungroupedCount }} root-level pages (homepage, about, legal, etc.)
        </p>
      </UCard>

      <!-- Crawl options + start -->
      <UCard>
        <div class="flex items-end gap-4">
          <div class="flex-1">
            <label
              for="page-limit"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Page limit
            </label>
            <UInput
              id="page-limit"
              v-model.number="pageLimit"
              type="number"
              :min="1"
              :max="500"
              size="md"
            />
          </div>
          <div class="flex gap-2">
            <UButton
              label="Skip & Crawl All"
              variant="outline"
              color="neutral"
              size="md"
              :loading="isSubmitting"
              @click="handleSkipAndCrawl"
            />
            <UButton
              label="Start Crawl"
              icon="i-heroicons-arrow-path"
              color="primary"
              size="md"
              :loading="isSubmitting"
              :disabled="selectedGroups.size === 0 || isSubmitting"
              @click="handleStartCrawl"
            />
          </div>
        </div>
      </UCard>
    </div>

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
