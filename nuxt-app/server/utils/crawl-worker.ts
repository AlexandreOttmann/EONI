import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '~/types/database.types'
import { chunkMarkdown } from './chunker'
import { embedTexts } from './embedder'

export type WorkerConfig = {
  jobId: string
  merchantId: string
  merchantName: string
  cloudflareAccountId: string
  cloudflareCrawlApiToken: string
  openaiApiKey: string
  supabaseUrl: string
  supabaseServiceRoleKey: string
}

type CfRecord = {
  url: string
  status: string
  metadata: {
    title?: string
    status?: number
    [key: string]: unknown
  }
  html: string
}

type CfPollResult = {
  success: boolean
  result: {
    id: string
    status: string
    total?: number
    finished?: number
    skipped?: number
    records?: CfRecord[]
  }
}

// Normalised page shape used internally after parsing the CF response
type CfPage = { url: string, title: string, text: string }

const POLL_INTERVAL_MS = 20_000
const POLL_TIMEOUT_MS = 10 * 60 * 1_000
const BACKOFF_MAX_MS = 60_000

const CF_TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled_due_to_timeout',
  'cancelled_due_to_limits',
  'cancelled_by_user',
  'errored'
])

function cfCrawlUrl(accountId: string, cfJobId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl/${cfJobId}`
}

async function deleteCfJob(config: WorkerConfig, cfJobId: string): Promise<void> {
  try {
    await $fetch(cfCrawlUrl(config.cloudflareAccountId, cfJobId), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.cloudflareCrawlApiToken}` }
    })
  } catch {
    // Best-effort cleanup
  }
}

/** Strip HTML tags + common entities to plain text for chunking */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function resumeFromCfJob(config: WorkerConfig, cfJobId: string): Promise<void> {
  const client = createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey)

  try {
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let pages: CfPage[] = []
    let currentInterval = POLL_INTERVAL_MS

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, currentInterval))

      let cfPoll: CfPollResult
      try {
        cfPoll = await $fetch<CfPollResult>(
          `${cfCrawlUrl(config.cloudflareAccountId, cfJobId)}?limit=1`,
          {
            headers: { Authorization: `Bearer ${config.cloudflareCrawlApiToken}` }
          }
        )
      } catch (err: unknown) {
        type FetchError = { statusCode?: number, status?: number }
        const statusCode = (err as FetchError).statusCode ?? (err as FetchError).status
        if (statusCode === 429) {
          currentInterval = Math.min(currentInterval * 2, BACKOFF_MAX_MS)
          continue
        }
        throw err
      }

      currentInterval = POLL_INTERVAL_MS

      if (!cfPoll.success) throw new Error('Cloudflare crawl poll failed')

      const status = cfPoll.result.status

      if (status === 'completed') {
        // Fetch full records without limit
        const fullPoll = await $fetch<CfPollResult>(
          cfCrawlUrl(config.cloudflareAccountId, cfJobId),
          {
            headers: { Authorization: `Bearer ${config.cloudflareCrawlApiToken}` }
          }
        )
        pages = (fullPoll.result.records ?? [])
          .filter(r => r.status === 'completed')
          .map(r => ({
            url: r.url,
            title: r.metadata?.title ?? '',
            text: htmlToText(r.html ?? '')
          }))
        break
      }

      if (CF_TERMINAL_STATUSES.has(status)) {
        await deleteCfJob(config, cfJobId)
        throw new Error(`Cloudflare crawl terminated with status: ${status}`)
      }
      // status is 'pending' or 'running' — keep polling
    }

    if (pages.length === 0 && Date.now() >= deadline) {
      await deleteCfJob(config, cfJobId)
      throw new Error('Cloudflare crawl timed out after 10 minutes')
    }

    await client.from('crawl_jobs').update({ pages_found: pages.length }).eq('id', config.jobId)

    await processPages(config, pages, client)
  } catch (err) {
    await deleteCfJob(config, cfJobId)
    const message = err instanceof Error ? err.message : 'Unknown error'
    await client
      .from('crawl_jobs')
      .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
      .eq('id', config.jobId)
  }
}

export async function processPages(
  config: WorkerConfig,
  pages: CfPage[],
  client: SupabaseClient<Database>
): Promise<void> {
  for (const page of pages) {
    // Idempotency check — skip if page already processed (e.g. resumed after restart)
    const { data: existing } = await client
      .from('pages')
      .select('id')
      .eq('crawl_job_id', config.jobId)
      .eq('url', page.url)
      .limit(1)
      .maybeSingle()

    if (existing) continue

    const { data: pageRow } = await client
      .from('pages')
      .insert({
        merchant_id: config.merchantId,
        crawl_job_id: config.jobId,
        url: page.url,
        title: page.title,
        markdown: page.text
      })
      .select('id')
      .single()

    if (!pageRow) continue

    const rawChunks = chunkMarkdown(page.text, page.url, page.title, config.merchantName)
    if (rawChunks.length === 0) continue

    const embeddings = await embedTexts(rawChunks.map(c => c.content), config.openaiApiKey)

    const chunkRows = rawChunks.map((c, i) => ({
      merchant_id: config.merchantId,
      page_id: pageRow.id,
      content: c.content,
      embedding: JSON.stringify(embeddings[i]),
      metadata: c.metadata as Json,
      token_count: c.tokenCount
    }))

    await client.from('chunks').insert(chunkRows)

    // Fetch current counters then increment
    const { data: currentJob } = await client
      .from('crawl_jobs')
      .select('pages_crawled, chunks_created')
      .eq('id', config.jobId)
      .single()

    if (currentJob) {
      await client
        .from('crawl_jobs')
        .update({
          pages_crawled: (currentJob.pages_crawled ?? 0) + 1,
          chunks_created: (currentJob.chunks_created ?? 0) + rawChunks.length
        })
        .eq('id', config.jobId)
    }
  }

  await client
    .from('crawl_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), cf_job_id: null })
    .eq('id', config.jobId)
}
