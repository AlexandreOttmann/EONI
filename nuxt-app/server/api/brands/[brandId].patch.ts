import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand } from '~/types/api'
import { extractRootDomain, InvalidUrlError } from '../../utils/domain'

const paramsSchema = z.object({
  brandId: z.string().uuid(),
})

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  // Legacy single-domain write path (back-compat). Maps to `domains = [domain]`
  // at write time — the physical `domain` column is generated since 0039.
  domain: z.string().min(1).optional(),
  // New multi-domain write path. Each entry is normalized via extractRootDomain;
  // if it's already bare (e.g. "example.com"), wrap with https:// so the parser
  // accepts it.
  domains: z.array(z.string().min(1)).max(20).optional(),
  logo_url: z.string().url().optional(),
})

/**
 * Normalize a caller-supplied domain/URL into a bare root hostname using the
 * existing Phase A helper. Accepts either a full URL ("https://foo.com/bar")
 * or a bare hostname ("foo.com", "www.foo.com"). Throws createError(400) on
 * anything that can't be parsed.
 */
function normalizeDomainInput(raw: string): string {
  const trimmed = raw.trim()
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return extractRootDomain(candidate)
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      throw createError({ statusCode: 400, message: `Invalid domain: ${raw}` })
    }
    throw err
  }
}

export default defineEventHandler(async (event): Promise<{ brand: Brand }> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { brandId } = paramsSchema.parse({ brandId: getRouterParam(event, 'brandId') })
  const body = await readValidatedBody(event, bodySchema.parse)
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const updatePayload: Record<string, unknown> = {}
  if (body.name !== undefined) updatePayload.name = body.name
  if (body.description !== undefined) updatePayload.description = body.description
  if (body.logo_url !== undefined) updatePayload.logo_url = body.logo_url

  // `domains` takes precedence; `domain` is a convenience that maps to [domain].
  if (body.domains !== undefined) {
    const normalized = body.domains.map(normalizeDomainInput)
    // Dedupe while preserving order.
    updatePayload.domains = Array.from(new Set(normalized))
  } else if (body.domain !== undefined) {
    updatePayload.domains = [normalizeDomainInput(body.domain)]
  }

  if (Object.keys(updatePayload).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const { data, error } = await client
    .from('brands')
    .update(updatePayload)
    .eq('id', brandId)
    .eq('merchant_id', merchantId)
    .select('*')
    .single()

  if (error || !data) {
    consola.error('Failed to update brand', { merchantId, brandId, error: error?.message })
    throw createError({ statusCode: 404, message: 'Brand not found' })
  }

  consola.info('Brand updated', { merchantId, brandId })
  return { brand: data as unknown as Brand }
})
