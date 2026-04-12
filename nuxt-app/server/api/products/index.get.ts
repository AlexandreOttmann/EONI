import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Product, ProductsListResponse } from '~/types/api'

const querySchema = z.object({
  brand_id: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event): Promise<ProductsListResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = await getValidatedQuery(event, querySchema.parse)
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const offset = (query.page - 1) * query.limit

  let builder = client
    .from('products')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchantId)

  if (query.brand_id) {
    builder = builder.eq('brand_id', query.brand_id)
  }

  if (query.search) {
    builder = builder.or(`name.ilike.%${query.search}%,description.ilike.%${query.search}%`)
  }

  if (query.category) {
    builder = builder.eq('category', query.category)
  }

  builder = builder
    .order('created_at', { ascending: false })
    .range(offset, offset + query.limit - 1)

  const { data, error, count } = await builder

  if (error) {
    consola.error('Failed to fetch products', { merchantId, error: error.message })
    throw createError({ statusCode: 500, message: 'Failed to fetch products' })
  }

  return {
    products: (data ?? []) as unknown as Product[],
    total: count ?? 0,
    page: query.page,
    limit: query.limit,
  }
})
