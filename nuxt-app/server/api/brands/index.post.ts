import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand } from '~/types/api'
import { extractRootDomain, InvalidUrlError } from '../../utils/domain'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  // Accept either a full URL or a bare hostname; normalized to a root domain.
  domain: z.string().min(1).optional(),
})

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

  const body = await readValidatedBody(event, bodySchema.parse)
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  // `domain` column is generated since migration 0039 — write to `domains`.
  const domains = body.domain ? [normalizeDomainInput(body.domain)] : []

  const { data, error } = await client
    .from('brands')
    .insert({
      merchant_id: merchantId,
      name: body.name,
      domains,
    })
    .select('*')
    .single()

  if (error) {
    consola.error('Failed to create brand', { merchantId, error: error.message })
    throw createError({ statusCode: 500, message: 'Failed to create brand' })
  }

  consola.info('Brand created', { merchantId, brandId: data.id, name: body.name })
  return { brand: data as unknown as Brand }
})
