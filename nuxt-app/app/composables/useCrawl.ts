import type { StartCrawlResponse, CrawlStatusResponse, CrawlJobsResponse, DiscoverResponse, SitemapGroup } from '~/types/api'

export function useCrawl() {
  const toast = useToast()

  const activeJob = ref<import('~/types/api').CrawlJob | null>(null)
  const jobHistory = ref<import('~/types/api').CrawlJob[]>([])
  const isPolling = ref(false)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  // Discovery state
  const sitemapGroups = ref<SitemapGroup[]>([])
  const sitemapFound = ref(false)
  const totalSitemapUrls = ref(0)
  const ungroupedCount = ref(0)
  const isDiscovering = ref(false)
  const discoveryError = ref<string | null>(null)

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    isPolling.value = false
  }

  async function pollStatus(jobId: string) {
    try {
      const { job } = await $fetch<CrawlStatusResponse>(`/api/crawl/status/${jobId}`)
      activeJob.value = job
      if (job.status === 'completed' || job.status === 'failed') {
        stopPolling()
        if (job.status === 'completed') {
          activeJob.value = null
        }
        await loadHistory()
        if (job.status === 'failed') {
          toast.add({ title: 'Crawl failed', description: job.error ?? 'Unknown error', color: 'error' })
        }
      }
    } catch {
      stopPolling()
    }
  }

  function startPolling(jobId: string) {
    stopPolling()
    isPolling.value = true
    pollStatus(jobId)
    pollInterval = setInterval(() => pollStatus(jobId), 3000)
  }

  async function loadHistory() {
    try {
      const { jobs } = await $fetch<CrawlJobsResponse>('/api/crawl/jobs')
      jobHistory.value = jobs
      const latest = jobs[0]
      if (latest && (latest.status === 'pending' || latest.status === 'running') && !isPolling.value) {
        activeJob.value = latest
        startPolling(latest.id)
      }
    } catch {
      // silent — history is non-critical
    }
  }

  async function discoverSite(url: string) {
    isDiscovering.value = true
    discoveryError.value = null
    sitemapGroups.value = []
    sitemapFound.value = false
    totalSitemapUrls.value = 0
    ungroupedCount.value = 0

    try {
      const result = await $fetch<DiscoverResponse>('/api/crawl/discover', {
        method: 'POST',
        body: { url }
      })

      sitemapFound.value = result.sitemap_found
      sitemapGroups.value = result.groups
      totalSitemapUrls.value = result.total_urls
      ungroupedCount.value = result.ungrouped_count

      return result
    } catch (err: unknown) {
      discoveryError.value = 'Failed to analyze site structure.'
      toast.add({ title: 'Discovery failed', description: 'Could not fetch sitemap. You can still start a crawl.', color: 'warning' })
      throw err
    } finally {
      isDiscovering.value = false
    }
  }

  function resetDiscovery() {
    sitemapGroups.value = []
    sitemapFound.value = false
    totalSitemapUrls.value = 0
    ungroupedCount.value = 0
    discoveryError.value = null
  }

  async function startCrawl(url: string, options?: {
    limit?: number
    includePatterns?: string[]
    excludePatterns?: string[]
    brandId?: string
  }) {
    try {
      const { job_id } = await $fetch<StartCrawlResponse>('/api/crawl/start', {
        method: 'POST',
        body: {
          url,
          limit: options?.limit,
          includePatterns: options?.includePatterns,
          excludePatterns: options?.excludePatterns,
          brand_id: options?.brandId
        }
      })
      startPolling(job_id)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      const message = status === 409
        ? 'A crawl is already in progress.'
        : 'Failed to start crawl. Please try again.'
      toast.add({ title: 'Error', description: message, color: 'error' })
      throw err
    }
  }

  onUnmounted(stopPolling)

  return {
    activeJob,
    jobHistory,
    isPolling,
    startCrawl,
    loadHistory,
    // Discovery
    sitemapGroups,
    sitemapFound,
    totalSitemapUrls,
    ungroupedCount,
    isDiscovering,
    discoveryError,
    discoverSite,
    resetDiscovery
  }
}
