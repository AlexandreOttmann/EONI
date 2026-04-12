import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand } from '~/types/api'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().url().optional(),
})

export default defineEventHandler(async (event): Promise<{ brand: Brand }> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('brands')
    .insert({
      merchant_id: merchantId,
      name: body.name,
      domain: body.domain ?? null,
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
