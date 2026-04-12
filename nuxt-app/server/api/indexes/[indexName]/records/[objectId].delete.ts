// DELETE /api/indexes/:indexName/records/:objectId
// Delete a single record and its edges.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const indexName = validateIndexName(getRouterParam(event, 'indexName'))
  const objectId = validateObjectId(getRouterParam(event, 'objectId'))

  const supabase = await serverSupabaseServiceRole(event)

  // Fetch the record id first (needed to delete edges)
  const { data: record } = await supabase
    .from('records')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('index_name', indexName)
    .eq('object_id', objectId)
    .single()

  if (!record) throw createError({ statusCode: 404, message: 'Record not found' })

  // Delete edges (cascade would also handle this, but be explicit)
  await supabase
    .from('record_edges')
    .delete()
    .or(`source_record_id.eq.${record.id},target_record_id.eq.${record.id}`)
    .eq('merchant_id', merchantId)

  const { error } = await supabase
    .from('records')
    .delete()
    .eq('id', record.id)
    .eq('merchant_id', merchantId)

  if (error) throw createError({ statusCode: 500, message: 'Database error' })

  return { objectId, indexName, status: 'deleted' }
})
