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
  markdown?: string
  json?: { items?: Array<Record<string, unknown>> }
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
type CfPage = {
  url: string
  title: string
  text: string
  items: Array<Record<string, unknown>>
}

type ExtractionConfidence = 'high' | 'medium' | 'low'

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
            text: r.markdown ?? '',
            items: r.json?.items ?? []
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

function determineExtractionConfidence(
  item: Record<string, unknown>
): ExtractionConfidence {
  const hasName = typeof item.name === 'string' && item.name.length > 0
  const hasDescription = typeof item.description === 'string' && item.description.length > 0
  const hasPrice = typeof item.price === 'number'

  if (!hasName) return 'low'

  const missingCount = [
    !hasDescription,
    !hasPrice,
    !item.currency,
    !item.availability,
    !item.category
  ].filter(Boolean).length

  if (hasName && hasDescription && hasPrice) return 'high'
  if (missingCount >= 2) return 'low'
  return 'medium'
}

function getMissingFields(item: Record<string, unknown>): string[] {
  const fields: Array<keyof typeof item> = ['description', 'price', 'currency', 'availability', 'category']
  return fields.filter(f => item[f] === null || item[f] === undefined || item[f] === '')
}

function buildProductEmbeddingText(item: Record<string, unknown>, sourceUrl: string): string {
  const name = typeof item.name === 'string' ? item.name : ''
  const description = typeof item.description === 'string' ? item.description : 'N/A'
  const price = typeof item.price === 'number' ? String(item.price) : 'N/A'
  const currency = typeof item.currency === 'string' ? item.currency : ''
  const availability = typeof item.availability === 'string' ? item.availability : 'unknown'
  const category = typeof item.category === 'string' ? item.category : 'N/A'

  return [
    `Product: ${name}`,
    `Description: ${description}`,
    `Price: ${price}${currency ? ' ' + currency : ''}`,
    `Availability: ${availability}`,
    `Category: ${category}`,
    `Source: ${sourceUrl}`
  ].join('\n')
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
      embedding: embeddings[i] as unknown as string,
      metadata: c.metadata as Json,
      token_count: c.tokenCount
    }))

    await client.from('chunks').insert(chunkRows)

    // Fetch current counters then increment
    const { data: currentJob } = await client
      .from('crawl_jobs')
      .select('pages_crawled, chunks_created, products_extracted')
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

    // ── Product extraction ────────────────────────────────────────
    const validItems = (page.items ?? []).filter(
      item => typeof item.name === 'string' && item.name.trim().length > 0
    )

    if (validItems.length > 0) {
      const productTexts = validItems.map(item =>
        buildProductEmbeddingText(item, page.url)
      )

      const productEmbeddings = await embedTexts(productTexts, config.openaiApiKey)

      const productRows = validItems.map((item, i) => {
        const confidence: ExtractionConfidence = determineExtractionConfidence(item)
        const missingFields = getMissingFields(item)

        return {
          merchant_id: config.merchantId,
          page_id: pageRow.id,
          crawl_job_id: config.jobId,
          name: item.name as string,
          description: typeof item.description === 'string' ? item.description : null,
          price: typeof item.price === 'number' ? item.price : null,
          currency: typeof item.currency === 'string' ? item.currency : 'EUR',
          availability: typeof item.availability === 'string' ? item.availability : 'unknown',
          sku: typeof item.sku === 'string' ? item.sku : null,
          category: typeof item.category === 'string' ? item.category : null,
          image_url: typeof item.image_url === 'string' ? item.image_url : null,
          source_url: page.url,
          extra_data: {} as Json,
          extraction_confidence: confidence,
          missing_fields: missingFields,
          embedding: productEmbeddings[i] as unknown as string
        }
      })

      await client.from('products').insert(productRows)

      // Increment products_extracted counter
      const { data: jobAfterChunks } = await client
        .from('crawl_jobs')
        .select('products_extracted')
        .eq('id', config.jobId)
        .single()

      if (jobAfterChunks) {
        await client
          .from('crawl_jobs')
          .update({
            products_extracted: (jobAfterChunks.products_extracted ?? 0) + validItems.length
          })
          .eq('id', config.jobId)
      }
    }
  }

  await client
    .from('crawl_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), cf_job_id: null })
    .eq('id', config.jobId)
}
