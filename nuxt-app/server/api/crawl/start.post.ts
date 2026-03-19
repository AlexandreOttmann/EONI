import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { StartCrawlResponse } from '~/types/api'
import { resumeFromCfJob } from '../../utils/crawl-worker'
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from '../../utils/extraction-prompts'

const bodySchema = z.object({
  url: z.string().url()
})

async function processJob(
  jobId: string,
  url: string,
  merchantId: string,
  merchantName: string,
  config: { cloudflareAccountId: string, cloudflareCrawlApiToken: string, openaiApiKey: string }
) {
  const { createClient } = await import('@supabase/supabase-js')
  const runtimeConfig = useRuntimeConfig()
  const client = createClient(
    runtimeConfig.supabaseUrl as string,
    runtimeConfig.supabaseServiceRoleKey as string
  )

  try {
    await client
      .from('crawl_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)

    const cfSubmit = await $fetch<{ success: boolean, result: string }>(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/browser-rendering/crawl`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflareCrawlApiToken}`,
          'Content-Type': 'application/json'
        },
        body: {
          url,
          formats: ['markdown', 'json'],
          rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
          jsonOptions: {
            prompt: EXTRACTION_PROMPT,
            response_format: EXTRACTION_SCHEMA
          }
        }
      }
    )

    if (!cfSubmit.success) throw new Error('Cloudflare crawl submission failed')

    const cfJobId = cfSubmit.result

    // Persist before polling — enables restart recovery
    await client.from('crawl_jobs').update({ cf_job_id: cfJobId }).eq('id', jobId)

    await resumeFromCfJob(
      {
        jobId,
        merchantId,
        merchantName,
        ...config,
        supabaseUrl: runtimeConfig.supabaseUrl as string,
        supabaseServiceRoleKey: runtimeConfig.supabaseServiceRoleKey as string
      },
      cfJobId
    )
  } catch (err) {
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
    .eq('merchant_id', user.sub)
    .in('status', ['pending', 'running'])
    .limit(1)
    .maybeSingle()

  if (running) throw createError({ statusCode: 409, message: 'A crawl is already in progress' })

  // Get merchant name
  const { data: merchant } = await client
    .from('merchants')
    .select('name')
    .eq('id', user.sub)
    .single()

  const { data: job, error } = await client
    .from('crawl_jobs')
    .insert({ merchant_id: user.sub, url: body.url, status: 'pending' })
    .select('id')
    .single()

  if (error || !job) throw createError({ statusCode: 500, message: 'Failed to create crawl job' })

  const config = useRuntimeConfig(event)

  // Fire-and-forget background processing
  processJob(
    job.id,
    body.url,
    user.sub,
    merchant?.name ?? 'Merchant',
    {
      cloudflareAccountId: config.cloudflareAccountId as string,
      cloudflareCrawlApiToken: config.cloudflareCrawlApiToken as string,
      openaiApiKey: config.openaiApiKey as string
    }
  ).catch(() => { /* errors handled inside processJob */ })

  return { job_id: job.id, status: 'pending' }
})
