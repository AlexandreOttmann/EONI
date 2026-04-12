// GET /api/indexes
// Returns all indexes for the authenticated merchant — both registered (possibly
// empty) ones and any that have records. Merges both sources.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const supabase = await serverSupabaseServiceRole(event)

  // Registered index names (may have 0 records)
  const { data: registeredData, error: regError } = await supabase
    .from('indexes')
    .select('name, created_at')
    .eq('merchant_id', merchantId)

  const { data: recordsData, error: recError } = await supabase
    .from('records')
    .select('index_name, updated_at')
    .eq('merchant_id', merchantId)

  if (regError || recError) throw createError({ statusCode: 500, message: 'Database error' })

  // Build map from records grouped by index_name
  const indexMap = new Map<string, { count: number, updatedAt: string }>()
  for (const row of recordsData ?? []) {
    const entry = indexMap.get(row.index_name)
    if (!entry) {
      indexMap.set(row.index_name, { count: 1, updatedAt: row.updated_at })
    } else {
      entry.count++
      if (row.updated_at > entry.updatedAt) entry.updatedAt = row.updated_at
    }
  }

  // Overlay registered indexes that have no records yet
  for (const row of registeredData ?? []) {
    if (!indexMap.has(row.name)) {
      indexMap.set(row.name, { count: 0, updatedAt: row.created_at })
    }
  }

  const indexes = Array.from(indexMap.entries()).map(([indexName, { count, updatedAt }]) => ({
    indexName,
    count,
    updatedAt
  }))

  return { indexes }
})
