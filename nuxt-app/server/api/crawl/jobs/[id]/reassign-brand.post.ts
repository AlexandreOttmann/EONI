import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { extractRootDomain, titleCaseFromDomain, InvalidUrlError } from '../../../../utils/domain'
import type {
  ReassignCrawlBrandResponse,
  BrandDomainMismatchError
} from '~/types/api'

const bodySchema = z.object({
  target_brand_id: z.string().uuid()
})

const jobIdSchema = z.string().uuid()

interface ReassignCounts {
  pages: number
  chunks: number
  records: number
}

export default defineEventHandler(async (event): Promise<ReassignCrawlBrandResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const merchantId = user.sub
  if (!merchantId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rawJobId = getRouterParam(event, 'id')
  const jobIdResult = jobIdSchema.safeParse(rawJobId)
  if (!jobIdResult.success) {
    throw createError({ statusCode: 400, message: 'Invalid crawl job id' })
  }
  const jobId = jobIdResult.data

  const body = await readValidatedBody(event, bodySchema.parse)

  const client = await serverSupabaseServiceRole(event)

  // 1. Load the crawl job scoped by merchant. The start URL is `url`
  //    (verified in migration 0001_initial_schema.sql — no `start_url` column).
  const { data: job, error: jobError } = await client
    .from('crawl_jobs')
    .select('id, url, merchant_id, brand_id')
    .eq('id', jobId)
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (jobError) {
    throw createError({ statusCode: 500, message: 'Failed to load crawl job' })
  }
  if (!job) {
    throw createError({ statusCode: 404, message: 'Crawl job not found' })
  }

  // 2. Load the target brand scoped by merchant and read its domains array.
  const { data: targetBrand, error: brandError } = await client
    .from('brands')
    .select('id, name, domains')
    .eq('id', body.target_brand_id)
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (brandError) {
    throw createError({ statusCode: 500, message: 'Failed to load target brand' })
  }
  if (!targetBrand) {
    throw createError({ statusCode: 404, message: 'Target brand not found' })
  }

  // 3. Compute the crawl's root domain and enforce brand-domain membership.
  //    A brand with an empty `domains` array is considered unbound — we let
  //    the reassign through (the RPC will flip the rows; the caller can then
  //    auto-claim the domain via the brand patch endpoint if desired).
  let crawlDomain: string
  try {
    crawlDomain = extractRootDomain(job.url)
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      throw createError({ statusCode: 400, message: 'Crawl job has an invalid URL' })
    }
    throw err
  }

  const brandDomains: string[] = Array.isArray(targetBrand.domains) ? targetBrand.domains : []

  if (brandDomains.length > 0 && !brandDomains.includes(crawlDomain)) {
    // Mirror the Phase A error shape used by start.post.ts + discover.post.ts
    // so the frontend's existing BrandDomainMismatchError handler Just Works.
    const mismatchData: BrandDomainMismatchError = {
      code: 'brand_domain_mismatch',
      brand_id: targetBrand.id,
      brand_domain: brandDomains[0] ?? '',
      crawl_domain: crawlDomain,
      message:
        `This crawl is for ${crawlDomain} but the selected brand `
        + `"${targetBrand.name}" is bound to ${brandDomains.join(', ')}. `
        + `Pick a brand that owns ${crawlDomain}, or update the brand's domains.`,
      suggested_brand_name: titleCaseFromDomain(crawlDomain)
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'brand_domain_mismatch',
      data: {
        ...mismatchData,
        brand_domains: brandDomains
      }
    })
  }

  // 4. Call the RPC. The function performs its own ownership checks defensively
  //    and runs every update inside a single Postgres transaction.
  //
  //    The untyped-rpc shim is required until database.types.ts is
  //    regenerated to include `reassign_crawl_brand` (migration 0040).
  //    Once regeneration lands this shim can be removed. It does NOT widen
  //    anything else — ownership, merchant_id, and argument shape are all
  //    enforced locally above and inside the RPC itself.
  interface UntypedRpcClient {
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown, error: { message: string } | null }>
  }
  const rpcClient = client as unknown as UntypedRpcClient
  const { data: rpcData, error: rpcError } = await rpcClient.rpc('reassign_crawl_brand', {
    p_merchant_id: merchantId,
    p_crawl_job_id: jobId,
    p_target_brand_id: body.target_brand_id
  })

  if (rpcError) {
    // Translate known guard failures to proper HTTP statuses. The raw messages
    // are never forwarded to the client — every mapped response is opaque.
    const msg = rpcError.message ?? ''

    if (msg.includes('crawl_job_not_found') || msg.includes('brand_not_found')) {
      throw createError({ statusCode: 404, message: 'Crawl job or brand not found' })
    }
    if (msg.includes('crawl_job_wrong_merchant') || msg.includes('brand_wrong_merchant')) {
      // Ownership failures also surface as 404 to avoid leaking existence.
      throw createError({ statusCode: 404, message: 'Crawl job or brand not found' })
    }

    throw createError({ statusCode: 500, message: 'Failed to reassign crawl brand' })
  }

  // The RPC returns jsonb_build_object(pages, chunks, records). Supabase-js
  // hands it back as a plain object.
  const counts = parseCounts(rpcData)

  return {
    job_id: jobId,
    target_brand_id: body.target_brand_id,
    counts
  }
})

function parseCounts(raw: unknown): ReassignCounts {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    return {
      pages: typeof r.pages === 'number' ? r.pages : 0,
      chunks: typeof r.chunks === 'number' ? r.chunks : 0,
      records: typeof r.records === 'number' ? r.records : 0
    }
  }
  return { pages: 0, chunks: 0, records: 0 }
}
