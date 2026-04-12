// GET /api/indexes/:indexName/records
// Paginated list of records in an index, with optional full-text search.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  search: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const indexName = validateIndexName(getRouterParam(event, 'indexName'))

  const query = await getValidatedQuery(event, querySchema.parse)
  const supabase = await serverSupabaseServiceRole(event)

  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1

  let q = supabase
    .from('records')
    .select('id, object_id, index_name, fields, brand_id, created_at, updated_at', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .eq('index_name', indexName)
    .range(from, to)
    .order('updated_at', { ascending: false })

  if (query.search) {
    q = q.ilike('searchable_text', `%${query.search}%`)
  }

  const { data, count, error } = await q

  if (error) throw createError({ statusCode: 500, message: 'Database error' })

  return { records: data ?? [], total: count ?? 0 }
})
