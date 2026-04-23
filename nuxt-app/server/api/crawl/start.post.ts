import { consola } from 'consola'
import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { StartCrawlResponse } from '~/types/api'
import { resumeFromCfJob } from '../../utils/crawl-worker'
import { extractRootDomain, titleCaseFromDomain, InvalidUrlError } from '../../utils/domain'
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from '../../utils/extraction-prompts'

const bodySchema = z.object({
  url: z.string().url().refine(u => /^https?:\/\//i.test(u), 'URL must use http or https'),
  limit: z.number().int().min(1).max(500).optional().default(100),
  includePatterns: z.array(z.string()).max(20).optional(),
  excludePatterns: z.array(z.string()).max(20).optional(),
  brand_id: z.string().uuid().optional()
})

interface CrawlOptions {
  limit: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

const DEFAULT_EXCLUDE_PATTERNS = [
  '*/cart*', '*/checkout*', '*/account*', '*/login*',
  '*/signup*', '*/admin*', '*/wp-admin*', '*/my-account*'
]

async function processJob(
  jobId: string,
  url: string,
  merchantId: string,
  merchantName: string,
  brandId: string | null,
  crawlOptions: CrawlOptions,
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

    // Build CF options — patterns go inside options per CF docs
    const mergedExclude = [
      ...DEFAULT_EXCLUDE_PATTERNS,
      ...(crawlOptions.excludePatterns ?? [])
    ]

    // CF expects full URL patterns (https://example.com/path/**), not path-only (/path/**)
    const origin = new URL(url).origin

    const cfOptions: Record<string, unknown> = {
      excludePatterns: mergedExclude.map(p => p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`)
    }
    if (crawlOptions.includePatterns?.length) {
      cfOptions.includePatterns = crawlOptions.includePatterns.map(p =>
        p.startsWith('http') ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`
      )
    }

    const cfBody = {
      url,
      limit: crawlOptions.limit,
      formats: ['markdown', 'json'],
      rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
      options: cfOptions,
      jsonOptions: {
        prompt: EXTRACTION_PROMPT,
        response_format: EXTRACTION_SCHEMA
      }
    }

    consola.debug(`[crawl-start] CF request: formats=${JSON.stringify(cfBody.formats)} limit=${cfBody.limit}`)

    const cfSubmit = await $fetch<{ success: boolean, result: string }>(
      `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/browser-rendering/crawl`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflareCrawlApiToken}`,
          'Content-Type': 'application/json'
        },
        body: cfBody
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
        brandId,
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

  // Verify brand ownership + enforce brand-domain membership.
  // A brand may own multiple domains (domains text[] since migration 0039).
  // Skip the guard entirely when no brand_id is provided (nullable brands
  // are still allowed per existing behavior).
  let brandDomainClaimed: string | undefined
  if (body.brand_id) {
    const { data: brand } = await client
      .from('brands')
      .select('id, name, domains')
      .eq('id', body.brand_id)
      .eq('merchant_id', user.sub) // multi-tenancy filter — do not remove
      .maybeSingle()

    if (!brand) throw createError({ statusCode: 404, message: 'Brand not found' })

    let crawlDomain: string
    try {
      crawlDomain = extractRootDomain(body.url)
    } catch (err) {
      if (err instanceof InvalidUrlError) {
        throw createError({ statusCode: 400, message: 'Invalid URL' })
      }
      throw err
    }

    const brandDomains: string[] = Array.isArray(brand.domains) ? brand.domains : []

    if (brandDomains.length === 0) {
      // First-crawl auto-claim: bind this brand to the URL's root domain.
      const { error: claimError } = await client
        .from('brands')
        .update({ domains: [crawlDomain], updated_at: new Date().toISOString() })
        .eq('id', body.brand_id)
        .eq('merchant_id', user.sub)

      if (claimError) {
        throw createError({ statusCode: 500, message: 'Failed to claim brand domain' })
      }
      brandDomainClaimed = crawlDomain
    } else if (!brandDomains.includes(crawlDomain)) {
      // Preserve the exact error shape the frontend depends on: surface the
      // primary domain (domains[0]) as `brand_domain` for the legacy field.
      throw createError({
        statusCode: 400,
        statusMessage: 'brand_domain_mismatch',
        data: {
          code: 'brand_domain_mismatch',
          brand_id: body.brand_id,
          brand_domain: brandDomains[0] ?? '',
          crawl_domain: crawlDomain,
          message: `This URL belongs to ${crawlDomain} but the selected brand "${brand.name}" is bound to ${brandDomains.join(', ')}. Create a new brand for ${crawlDomain}, or switch the active brand.`,
          suggested_brand_name: titleCaseFromDomain(crawlDomain)
        }
      })
    }
  }

  // Get merchant name
  const { data: merchant } = await client
    .from('merchants')
    .select('name')
    .eq('id', user.sub)
    .single()

  const { data: job, error } = await client
    .from('crawl_jobs')
    .insert({
      merchant_id: user.sub,
      brand_id: body.brand_id ?? null,
      url: body.url,
      status: 'pending',
      page_limit: body.limit,
      include_patterns: body.includePatterns ?? [],
      exclude_patterns: body.excludePatterns ?? []
    })
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
    body.brand_id ?? null,
    {
      limit: body.limit,
      includePatterns: body.includePatterns,
      excludePatterns: body.excludePatterns
    },
    {
      cloudflareAccountId: config.cloudflareAccountId as string,
      cloudflareCrawlApiToken: config.cloudflareCrawlApiToken as string,
      openaiApiKey: config.openaiApiKey as string
    }
  ).catch(() => { /* errors handled inside processJob */ })

  return {
    job_id: job.id,
    status: 'pending',
    ...(brandDomainClaimed ? { brand_domain_claimed: brandDomainClaimed } : {})
  }
})
