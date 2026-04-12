import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand } from '~/types/api'

const paramsSchema = z.object({
  brandId: z.string().uuid(),
})

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  domain: z.string().url().optional(),
  logo_url: z.string().url().optional(),
})

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
  if (body.domain !== undefined) updatePayload.domain = body.domain
  if (body.logo_url !== undefined) updatePayload.logo_url = body.logo_url

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
