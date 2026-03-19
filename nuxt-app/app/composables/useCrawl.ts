import type { StartCrawlResponse, CrawlStatusResponse, CrawlJobsResponse } from '~/types/api'

export function useCrawl() {
  const toast = useToast()

  const activeJob = ref<import('~/types/api').CrawlJob | null>(null)
  const jobHistory = ref<import('~/types/api').CrawlJob[]>([])
  const isPolling = ref(false)
  let pollInterval: ReturnType<typeof setInterval> | null = null

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

  async function startCrawl(url: string) {
    try {
      const { job_id } = await $fetch<StartCrawlResponse>('/api/crawl/start', {
        method: 'POST',
        body: { url }
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

  return { activeJob, jobHistory, isPolling, startCrawl, loadHistory }
}
