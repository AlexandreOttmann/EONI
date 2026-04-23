// GET /api/indexes
// Returns all indexes for the authenticated merchant — both registered (possibly
// empty) ones and any that have records. Merges both sources.
//
// Query params:
//   - brand_id (uuid, optional): when set, scope to indexes owned by this brand.
//
// Response rows include `brandId` so the frontend can distinguish same-named
// indexes belonging to different brands (e.g. two `products` indexes).
import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

const querySchema = z.object({
  brand_id: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const query = await getValidatedQuery(event, querySchema.parse)
  const brandFilter = query.brand_id ?? null

  const supabase = await serverSupabaseServiceRole(event)

  // Registered index names (may have 0 records)
  let regQuery = supabase
    .from('indexes')
    .select('name, brand_id, created_at')
    .eq('merchant_id', merchantId)
  if (brandFilter) regQuery = regQuery.eq('brand_id', brandFilter)

  const { data: registeredData, error: regError } = await regQuery

  let recQuery = supabase
    .from('records')
    .select('index_name, brand_id, updated_at')
    .eq('merchant_id', merchantId)
  if (brandFilter) recQuery = recQuery.eq('brand_id', brandFilter)

  const { data: recordsData, error: recError } = await recQuery

  if (regError || recError) throw createError({ statusCode: 500, message: 'Database error' })

  // Build map keyed by `${brandId ?? ''}::${name}` so same-named indexes under
  // different brands don't collide.
  const indexMap = new Map<string, { indexName: string, brandId: string | null, count: number, updatedAt: string }>()

  const keyFor = (name: string, brandId: string | null) => `${brandId ?? ''}::${name}`

  for (const row of recordsData ?? []) {
    const brandId = (row.brand_id as string | null) ?? null
    const key = keyFor(row.index_name, brandId)
    const entry = indexMap.get(key)
    if (!entry) {
      indexMap.set(key, { indexName: row.index_name, brandId, count: 1, updatedAt: row.updated_at })
    } else {
      entry.count++
      if (row.updated_at > entry.updatedAt) entry.updatedAt = row.updated_at
    }
  }

  // Overlay registered indexes that have no records yet
  for (const row of registeredData ?? []) {
    const brandId = (row.brand_id as string | null) ?? null
    const key = keyFor(row.name, brandId)
    if (!indexMap.has(key)) {
      indexMap.set(key, { indexName: row.name, brandId, count: 0, updatedAt: row.created_at })
    }
  }

  const indexes = Array.from(indexMap.values()).map(({ indexName, brandId, count, updatedAt }) => ({
    indexName,
    brandId,
    count,
    updatedAt
  }))

  return { indexes }
})
