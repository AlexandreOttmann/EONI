import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { consola } from 'consola'
import OpenAI from 'openai'
import type { Database, Json } from '~/types/database.types'
import { chunkMarkdown } from './chunker'
import { classifyPages, type ContentType } from './content-classifier'
import { extractBrandDescription } from './brand-extractor'
import { embedTexts } from './embedder'
import { processRecords } from './record-processor'
import { extractRecordsForPage, type ExtractedItem } from './extraction-prompts'

// Maps content-classifier output to the target records index name. `null`
// means "this page type produces no records" — chunks still land normally.
const CONTENT_TYPE_TO_INDEX: Record<ContentType, string | null> = {
  product: 'products',
  faq:     'faq',
  support: 'support',
  brand:   null,
  other:   null
}

export type WorkerConfig = {
  jobId: string
  merchantId: string
  merchantName: string
  brandId: string | null
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
  json?: { page_summary?: string, items?: Array<Record<string, unknown>> }
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
    cursor?: number
  }
}

// Normalised page shape used internally after parsing the CF response
type CfPage = {
  url: string
  title: string
  text: string
  items: Array<Record<string, unknown>>
  pageSummary: string | null
}

type ExtractionConfidence = 'high' | 'medium' | 'low'

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 20 * 60 * 1_000
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

// Fetch all newly-completed CF records since the last cursor position.
// Paginates until CF returns no more records.
async function fetchNewCompletedPages(
  config: WorkerConfig,
  cfJobId: string,
  fromCursor: number | undefined,
  processedUrls: Set<string>
): Promise<{ pages: CfPage[], nextCursor: number | undefined }> {
  const allPages: CfPage[] = []
  let cursor = fromCursor

  for (;;) {
    const params = new URLSearchParams({ status: 'completed' })
    if (cursor !== undefined) params.set('cursor', String(cursor))

    const result = await $fetch<CfPollResult>(
      `${cfCrawlUrl(config.cloudflareAccountId, cfJobId)}?${params}`,
      { headers: { Authorization: `Bearer ${config.cloudflareCrawlApiToken}` } }
    )

    const records = result.result.records ?? []
    for (const r of records) {
      if (r.status === 'completed' && !processedUrls.has(r.url)) {
        processedUrls.add(r.url)
        allPages.push({
          url: r.url,
          title: r.metadata?.title ?? '',
          text: r.markdown ?? '',
          items: r.json?.items ?? [],
          pageSummary: r.json?.page_summary ?? null
        })
      }
    }

    if (result.result.cursor && records.length > 0) {
      cursor = result.result.cursor
    } else {
      return { pages: allPages, nextCursor: cursor }
    }
  }
}

export async function resumeFromCfJob(config: WorkerConfig, cfJobId: string): Promise<void> {
  consola.info(`[crawl-worker] Worker started for job=${config.jobId} cfJob=${cfJobId}`)
  const client = createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey)

  // Progressive processing state
  let progressCursor: number | undefined
  const processedUrls = new Set<string>()
  let totalPagesProcessed = 0
  let totalChunksCreated = 0
  let totalProductsExtracted = 0

  try {
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let currentInterval = POLL_INTERVAL_MS
    let lastFinished = 0
    let staleSince = 0
    const STALE_TIMEOUT_MS = 2 * 60 * 1_000

    while (Date.now() < deadline) {
      consola.info(`[crawl-worker] Polling CF... (interval=${currentInterval}ms)`)
      await new Promise(resolve => setTimeout(resolve, currentInterval))

      let cfPoll: CfPollResult
      try {
        cfPoll = await $fetch<CfPollResult>(
          `${cfCrawlUrl(config.cloudflareAccountId, cfJobId)}?limit=1`,
          { headers: { Authorization: `Bearer ${config.cloudflareCrawlApiToken}` } }
        )
      } catch (err: unknown) {
        type FetchError = { statusCode?: number, status?: number }
        const statusCode = (err as FetchError).statusCode ?? (err as FetchError).status
        consola.warn(`[crawl-worker] Poll fetch error: status=${statusCode}`)
        if (statusCode === 429) {
          currentInterval = Math.min(currentInterval * 2, BACKOFF_MAX_MS)
          continue
        }
        throw err
      }

      currentInterval = POLL_INTERVAL_MS
      if (!cfPoll.success) throw new Error('Cloudflare crawl poll failed')

      const status = cfPoll.result.status
      const finished = cfPoll.result.finished ?? 0
      const total = cfPoll.result.total ?? 0
      consola.info(`[crawl-worker] CF status=${status} total=${total} finished=${finished} processed=${totalPagesProcessed}`)

      // Update pages_found as soon as CF reports a total
      if (total > 0) {
        await client.from('crawl_jobs').update({ pages_found: total }).eq('id', config.jobId)
      }

      // Track stale progress
      if (finished > lastFinished) {
        lastFinished = finished
        staleSince = 0
      } else if (finished > 0 && staleSince === 0) {
        staleSince = Date.now()
      }

      const isStaleAccept = staleSince > 0 && Date.now() - staleSince > STALE_TIMEOUT_MS && finished > total * 0.5
      if (isStaleAccept) {
        consola.info(`[crawl-worker] CF stale for 2min at ${finished}/${total}, accepting partial results`)
      }

      // Progressive: fetch and process newly-completed pages only when CF reports progress
      let newPages: CfPage[] = []
      let nextCursor = progressCursor
      if (finished > totalPagesProcessed) {
        const fetched = await fetchNewCompletedPages(config, cfJobId, progressCursor, processedUrls)
        newPages = fetched.pages
        nextCursor = fetched.nextCursor
      }

      if (newPages.length > 0) {
        consola.info(`[crawl-worker] Progressive batch: ${newPages.length} new pages to process`)
        const result = await processBatch(config, newPages, client)
        totalPagesProcessed += result.pagesProcessed
        totalChunksCreated += result.chunksCreated
        totalProductsExtracted += result.productsExtracted
        progressCursor = nextCursor

        await client
          .from('crawl_jobs')
          .update({
            pages_crawled: totalPagesProcessed,
            chunks_created: totalChunksCreated,
            products_extracted: totalProductsExtracted
          })
          .eq('id', config.jobId)
      }

      const isDone = status === 'completed' || isStaleAccept
      if (isDone) break

      if (CF_TERMINAL_STATUSES.has(status)) {
        await deleteCfJob(config, cfJobId)
        throw new Error(`Cloudflare crawl terminated with status: ${status}`)
      }
    }

    if (totalPagesProcessed === 0 && Date.now() >= deadline) {
      await deleteCfJob(config, cfJobId)
      throw new Error('Cloudflare crawl timed out after 20 minutes')
    }

    consola.info(`[crawl-worker] CF polling done. pages=${totalPagesProcessed} chunks=${totalChunksCreated} products=${totalProductsExtracted}`)

    // Brand description auto-extraction (after all pages are in)
    if (config.brandId) {
      try {
        const { data: brandChunks } = await client
          .from('chunks')
          .select('content')
          .eq('merchant_id', config.merchantId)
          .eq('brand_id', config.brandId)
          .eq('content_type', 'brand')
          .limit(20)

        consola.debug(`[crawl-worker] Found ${brandChunks?.length ?? 0} brand-typed chunks for extraction`)

        if (brandChunks && brandChunks.length > 0) {
          const description = await extractBrandDescription(brandChunks)
          if (description) {
            await client
              .from('brands')
              .update({ extracted_description: description })
              .eq('id', config.brandId)
              .eq('merchant_id', config.merchantId)

            consola.info(`[crawl-worker] Extracted brand description for brand ${config.brandId}`)
          }
        }
      } catch (err) {
        consola.error('[crawl-worker] Brand description extraction failed:', err)
        // Non-fatal
      }
    }

    await client
      .from('crawl_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), cf_job_id: null })
      .eq('id', config.jobId)
  } catch (err) {
    consola.error(`[crawl-worker] Job ${config.jobId} FAILED:`, err)
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

interface CollectedChunk {
  pageId: string
  content: string
  contentType: ContentType
  metadata: Json
  tokenCount: number
}

// Process a batch of pages: classify → collect chunks/records → embed → insert.
// Returns counts for the caller to accumulate into running totals.
async function processBatch(
  config: WorkerConfig,
  pages: CfPage[],
  client: SupabaseClient<Database>
): Promise<{ pagesProcessed: number, chunksCreated: number, productsExtracted: number }> {
  if (pages.length === 0) return { pagesProcessed: 0, chunksCreated: 0, productsExtracted: 0 }

  // ── Phase 1: Classify this batch ─────────────────────────────────
  const pageTypes = await classifyPages(
    pages.map(p => ({
      url: p.url,
      title: p.title,
      markdown: p.text,
      hasProducts: (p.items ?? []).some(
        item => typeof item.name === 'string' && item.name.trim().length > 0
      )
    }))
  )

  const typeCounts: Record<string, number> = {}
  for (const t of pageTypes) {
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  consola.debug(`[crawl-worker] Batch page types: ${JSON.stringify(typeCounts)}`)

  // Ensure an indexes row exists for every (merchantId, brandId, target) we
  // are about to write records into. Single upsert per unique target per
  // batch — cheap.
  const targetIndexes = new Set<string>()
  for (const t of pageTypes) {
    const name = CONTENT_TYPE_TO_INDEX[t]
    if (name) targetIndexes.add(name)
  }
  if (targetIndexes.size > 0) {
    await client.from('indexes').upsert(
      Array.from(targetIndexes).map(name => ({
        merchant_id: config.merchantId,
        brand_id: config.brandId ?? null,
        name
      })),
      { onConflict: 'merchant_id,brand_id,name', ignoreDuplicates: true }
    )
  }

  // Shared OpenAI client for FAQ/support extraction within this batch.
  const openai = new OpenAI({ apiKey: config.openaiApiKey })

  // ── Phase 2: Collect chunks + records (parallel, no embedding) ───
  const CONCURRENCY = 10
  let batchPagesProcessed = 0
  const allChunkData: CollectedChunk[] = []
  type RecordInput = Parameters<typeof processRecords>[0][number]
  const allRecordInputs: RecordInput[] = []

  async function collectOnePage(page: CfPage, pageType: ContentType): Promise<void> {
    const { data: existing } = await client
      .from('pages')
      .select('id')
      .eq('crawl_job_id', config.jobId)
      .eq('url', page.url)
      .limit(1)
      .maybeSingle()

    if (existing) return

    const { data: pageRow } = await client
      .from('pages')
      .insert({
        merchant_id: config.merchantId,
        brand_id: config.brandId,
        crawl_job_id: config.jobId,
        url: page.url,
        title: page.title,
        markdown: page.text
      })
      .select('id')
      .single()

    if (!pageRow) return

    const rawChunks = chunkMarkdown(page.text, page.url, page.title, config.merchantName)
    batchPagesProcessed++

    for (const c of rawChunks) {
      allChunkData.push({
        pageId: pageRow.id,
        content: c.content,
        contentType: pageType,
        metadata: c.metadata as Json,
        tokenCount: c.tokenCount
      })
    }

    const indexName = CONTENT_TYPE_TO_INDEX[pageType]
    if (!indexName) {
      consola.info(`[crawl-worker] Processed ${page.url} type=${pageType} chunks=${rawChunks.length} records=0 index=none`)
      return
    }

    // Dispatch to the right extractor per pageType. For `product`, the
    // dispatcher passes through page.items that Cloudflare already extracted.
    // For `faq`/`support`, it makes a GPT-4o-mini call. For `brand`/`other`,
    // it returns [] — but those are already handled above via the null guard.
    const extractedItems: ExtractedItem[] = await extractRecordsForPage(
      {
        url: page.url,
        title: page.title,
        markdown: page.text,
        items: page.items,
        pageSummary: page.pageSummary
      },
      pageType,
      openai
    )

    const pageContext = page.pageSummary || (page.text.length > 0 ? page.text.slice(0, 500) : null)
    let recordsForPage = 0

    for (const [index, item] of extractedItems.entries()) {
      if (item.__kind === 'product') {
        const raw = item as Record<string, unknown>
        // Preserve existing product validity rule: name required.
        if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue

        const productFields: Record<string, unknown> = {
          name: raw.name as string,
          description: typeof raw.description === 'string' ? raw.description : null,
          page_context: pageContext,
          price: typeof raw.price === 'number' ? raw.price : null,
          currency: typeof raw.currency === 'string' ? raw.currency : 'EUR',
          availability: typeof raw.availability === 'string' ? raw.availability : 'unknown',
          sku: typeof raw.sku === 'string' ? raw.sku : null,
          category: typeof raw.category === 'string' ? raw.category : null,
          image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
          source_url: page.url,
          extraction_confidence: determineExtractionConfidence(raw),
          missing_fields: getMissingFields(raw),
          crawl_job_id: config.jobId,
          page_id: pageRow.id
        }

        allRecordInputs.push({
          objectId: page.url + '#' + (typeof raw.sku === 'string' ? raw.sku : typeof raw.name === 'string' ? raw.name : String(index)),
          indexName,
          fields: productFields,
          merchantId: config.merchantId,
          brandId: config.brandId ?? undefined
        })
        recordsForPage++
      } else if (item.__kind === 'faq') {
        const faqFields: Record<string, unknown> = {
          question: item.question,
          answer: item.answer,
          topic: item.topic ?? null,
          page_context: pageContext,
          source_url: page.url,
          crawl_job_id: config.jobId,
          page_id: pageRow.id
        }

        allRecordInputs.push({
          objectId: page.url + '#' + (item.question || String(index)),
          indexName,
          fields: faqFields,
          merchantId: config.merchantId,
          brandId: config.brandId ?? undefined
        })
        recordsForPage++
      } else if (item.__kind === 'support') {
        const supportFields: Record<string, unknown> = {
          topic: item.topic,
          body: item.body,
          policy_type: item.policy_type,
          page_context: pageContext,
          source_url: page.url,
          crawl_job_id: config.jobId,
          page_id: pageRow.id
        }

        allRecordInputs.push({
          objectId: page.url + '#' + (item.topic || String(index)),
          indexName,
          fields: supportFields,
          merchantId: config.merchantId,
          brandId: config.brandId ?? undefined
        })
        recordsForPage++
      }
    }

    consola.info(`[crawl-worker] Processed ${page.url} type=${pageType} chunks=${rawChunks.length} records=${recordsForPage} index=${indexName}`)
  }

  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY)
    const batchTypes = pageTypes.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((page, idx) => collectOnePage(page, batchTypes[idx] ?? 'other')))
  }

  // ── Phase 3: Embed all chunks in one call ─────────────────────
  let chunksCreated = 0
  if (allChunkData.length > 0) {
    consola.info(`[crawl-worker] Embedding ${allChunkData.length} chunks...`)
    const embeddings = await embedTexts(allChunkData.map(c => c.content), config.openaiApiKey)

    // ── Phase 4: Bulk insert chunks ───────────────────────────────
    const CHUNK_INSERT_BATCH = 500
    const chunkRows = allChunkData.map((c, i) => ({
      merchant_id: config.merchantId,
      brand_id: config.brandId,
      page_id: c.pageId,
      content: c.content,
      content_type: c.contentType,
      embedding: embeddings[i] as unknown as string,
      metadata: c.metadata,
      token_count: c.tokenCount
    }))

    for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
      await client.from('chunks').insert(chunkRows.slice(i, i + CHUNK_INSERT_BATCH))
    }
    chunksCreated = chunkRows.length
    consola.info(`[crawl-worker] Inserted ${chunksCreated} chunks`)
  }

  // ── Phase 5: Process records (all indexes) ───────────────────
  let productsExtracted = 0
  if (allRecordInputs.length > 0) {
    const indexCounts: Record<string, number> = {}
    for (const r of allRecordInputs) {
      indexCounts[r.indexName] = (indexCounts[r.indexName] ?? 0) + 1
    }
    consola.info(`[crawl-worker] Processing ${allRecordInputs.length} records ${JSON.stringify(indexCounts)}...`)
    await processRecords(allRecordInputs, client, config.openaiApiKey)
    productsExtracted = allRecordInputs.length
    consola.info(`[crawl-worker] Processed ${productsExtracted} records`)
  }

  return { pagesProcessed: batchPagesProcessed, chunksCreated, productsExtracted }
}
