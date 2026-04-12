// DELETE /api/indexes/:indexName/records
// Clear all records (and their edges) in an index for this merchant.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const indexName = validateIndexName(getRouterParam(event, 'indexName'))

  const supabase = await serverSupabaseServiceRole(event)

  // Fetch all record IDs in this index
  const { data: records } = await supabase
    .from('records')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('index_name', indexName)

  const recordIds = (records ?? []).map(r => r.id as string)

  if (recordIds.length > 0) {
    await supabase
      .from('record_edges')
      .delete()
      .eq('merchant_id', merchantId)
      .in('source_record_id', recordIds)

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('merchant_id', merchantId)
      .eq('index_name', indexName)

    if (error) throw createError({ statusCode: 500, message: 'Database error' })
  }

  return { indexName, deletedCount: recordIds.length, status: 'cleared' }
})
