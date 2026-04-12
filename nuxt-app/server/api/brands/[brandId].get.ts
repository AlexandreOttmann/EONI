import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand } from '~/types/api'

const paramsSchema = z.object({
  brandId: z.string().uuid(),
})

export default defineEventHandler(async (event): Promise<{ brand: Brand & { product_count: number; chunk_count: number } }> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { brandId } = paramsSchema.parse({ brandId: getRouterParam(event, 'brandId') })
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const { data: brand, error } = await client
    .from('brands')
    .select('*')
    .eq('id', brandId)
    .eq('merchant_id', merchantId)
    .single()

  if (error || !brand) {
    throw createError({ statusCode: 404, message: 'Brand not found' })
  }

  // Fetch counts
  const [{ count: productCount }, { count: chunkCount }] = await Promise.all([
    client
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('brand_id', brandId),
    client
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('brand_id', brandId),
  ])

  return {
    brand: {
      ...(brand as unknown as Brand),
      product_count: productCount ?? 0,
      chunk_count: chunkCount ?? 0,
    },
  }
})
