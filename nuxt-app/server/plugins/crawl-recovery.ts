import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { resumeFromCfJob } from '../utils/crawl-worker'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const client = createClient<Database>(
    config.supabaseUrl as string,
    config.supabaseServiceRoleKey as string
  )

  // Recover jobs that have a cf_job_id — Cloudflare submission succeeded, can resume polling
  const { data: recoverable } = await client
    .from('crawl_jobs')
    .select('id, cf_job_id, merchant_id, url')
    .eq('status', 'running')
    .not('cf_job_id', 'is', null)

  for (const job of recoverable ?? []) {
    const { data: merchant } = await client
      .from('merchants')
      .select('name')
      .eq('id', job.merchant_id)
      .single()
    resumeFromCfJob(
      {
        jobId: job.id,
        merchantId: job.merchant_id,
        merchantName: merchant?.name ?? 'Merchant',
        cloudflareAccountId: config.cloudflareAccountId as string,
        cloudflareCrawlApiToken: config.cloudflareCrawlApiToken as string,
        openaiApiKey: config.openaiApiKey as string,
        supabaseUrl: config.supabaseUrl as string,
        supabaseServiceRoleKey: config.supabaseServiceRoleKey as string
      },
      job.cf_job_id!
    ).catch(() => {}) // errors handled inside resumeFromCfJob
  }

  // Mark unrecoverable jobs (running with no cf_job_id — crashed before CF submission)
  await client
    .from('crawl_jobs')
    .update({
      status: 'failed',
      error: 'Server restarted before crawl could be submitted',
      completed_at: new Date().toISOString()
    })
    .eq('status', 'running')
    .is('cf_job_id', null)
})
