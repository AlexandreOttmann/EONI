import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { StartCrawlResponse } from '~/types/api'
import { chunkMarkdown } from '../../utils/chunker'
import { embedTexts } from '../../utils/embedder'

const bodySchema = z.object({
  url: z.string().url()
})

async function processJob(
  jobId: string,
  url: string,
  merchantId: string,
  merchantName: string,
  config: { cloudflareAccountId: string; cloudflareCrawlApiToken: string; openaiApiKey: string }
) {
  const runtimeConfig = useRuntimeConfig()
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(
    runtimeConfig.supabaseUrl as string,
    runtimeConfig.supabaseServiceRoleKey as string
  )

  try {
    await client
      .from('crawl_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)

    const cfRes = await $fetch<{
      success: boolean
      result: { pages: Array<{ url: string; title: string; markdown: string }> }
    }>(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/browser-rendering/crawl`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudflareCrawlApiToken}`,
          'Content-Type': 'application/json'
        },
        body: { url }
      }
    )

    if (!cfRes.success) throw new Error('Cloudflare crawl failed')

    const pages = cfRes.result.pages
    await client.from('crawl_jobs').update({ pages_found: pages.length }).eq('id', jobId)

    for (const page of pages) {
      const { data: pageRow } = await client
        .from('pages')
        .insert({
          merchant_id: merchantId,
          crawl_job_id: jobId,
          url: page.url,
          title: page.title,
          markdown: page.markdown
        })
        .select('id')
        .single()

      if (!pageRow) continue

      const rawChunks = chunkMarkdown(page.markdown ?? '', page.url, page.title ?? '', merchantName)
      if (rawChunks.length === 0) continue

      const embeddings = await embedTexts(rawChunks.map(c => c.content), config.openaiApiKey)

      const chunkRows = rawChunks.map((c, i) => ({
        merchant_id: merchantId,
        page_id: pageRow.id,
        content: c.content,
        embedding: embeddings[i],
        metadata: c.metadata,
        token_count: c.tokenCount
      }))

      await client.from('chunks').insert(chunkRows)

      // Fetch current counters then increment atomically
      const { data: currentJob } = await client
        .from('crawl_jobs')
        .select('pages_crawled, chunks_created')
        .eq('id', jobId)
        .single()

      if (currentJob) {
        await client
          .from('crawl_jobs')
          .update({
            pages_crawled: currentJob.pages_crawled + 1,
            chunks_created: currentJob.chunks_created + rawChunks.length
          })
          .eq('id', jobId)
      }
    }

    await client
      .from('crawl_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await client
      .from('crawl_jobs')
      .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
      .eq('id', jobId)
  }
}

export default defineEventHandler(async (event): Promise<StartCrawlResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const client = await serverSupabaseServiceRole(event)

  // Check for already-running job
  const { data: running } = await client
    .from('crawl_jobs')
    .select('id')
    .eq('merchant_id', user.id)
    .in('status', ['pending', 'running'])
    .limit(1)
    .maybeSingle()

  if (running) throw createError({ statusCode: 409, message: 'A crawl is already in progress' })

  // Get merchant name
  const { data: merchant } = await client
    .from('merchants')
    .select('name')
    .eq('id', user.id)
    .single()

  const { data: job, error } = await client
    .from('crawl_jobs')
    .insert({ merchant_id: user.id, url: body.url, status: 'pending' })
    .select('id')
    .single()

  if (error || !job) throw createError({ statusCode: 500, message: 'Failed to create crawl job' })

  const config = useRuntimeConfig(event)

  // Fire-and-forget background processing
  processJob(
    job.id,
    body.url,
    user.id,
    merchant?.name ?? 'Merchant',
    {
      cloudflareAccountId: config.cloudflareAccountId as string,
      cloudflareCrawlApiToken: config.cloudflareCrawlApiToken as string,
      openaiApiKey: config.openaiApiKey as string
    }
  ).catch(() => { /* errors handled inside processJob */ })

  return { job_id: job.id, status: 'pending' }
})
