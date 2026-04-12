import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { Brand, BrandListResponse } from '~/types/api'

export interface BrandWithCounts extends Brand {
  product_count: number
  chunk_count: number
}

export default defineEventHandler(async (event): Promise<BrandListResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const { data: brands, error } = await client
    .from('brands')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (error) {
    consola.error('Failed to fetch brands', { merchantId, error: error.message })
    throw createError({ statusCode: 500, message: 'Failed to fetch brands' })
  }

  // Fetch product and chunk counts per brand
  const brandIds = (brands ?? []).map(b => b.id)

  const productCounts: Record<string, number> = {}
  const chunkCounts: Record<string, number> = {}

  if (brandIds.length > 0) {
    const { data: productData } = await client
      .from('products')
      .select('brand_id')
      .eq('merchant_id', merchantId)
      .in('brand_id', brandIds)

    if (productData) {
      for (const row of productData) {
        if (row.brand_id) {
          productCounts[row.brand_id] = (productCounts[row.brand_id] ?? 0) + 1
        }
      }
    }

    const { data: chunkData } = await client
      .from('chunks')
      .select('brand_id')
      .eq('merchant_id', merchantId)
      .in('brand_id', brandIds)

    if (chunkData) {
      for (const row of chunkData) {
        if (row.brand_id) {
          chunkCounts[row.brand_id] = (chunkCounts[row.brand_id] ?? 0) + 1
        }
      }
    }
  }

  const brandsWithCounts: BrandWithCounts[] = (brands ?? []).map(b => ({
    ...(b as unknown as Brand),
    product_count: productCounts[b.id] ?? 0,
    chunk_count: chunkCounts[b.id] ?? 0
  }))

  return { brands: brandsWithCounts }
})
