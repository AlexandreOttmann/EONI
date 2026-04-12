// PATCH /api/indexes/:indexName/records/:objectId
// Partial update — merges new fields into existing record and re-embeds.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

import { z } from 'zod'

const bodySchema = z.object({
  fields: z.record(z.string(), recordValueSchema)
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const indexName = validateIndexName(getRouterParam(event, 'indexName'))
  const objectId = validateObjectId(getRouterParam(event, 'objectId'))

  const body = await readValidatedBody(event, bodySchema.parse)

  const openaiApiKey = useRuntimeConfig().openaiApiKey as string
  if (!openaiApiKey) throw createError({ statusCode: 500, message: 'OpenAI API key not configured' })

  const supabase = await serverSupabaseServiceRole(event)

  // Fetch existing record
  const { data: existing, error: fetchError } = await supabase
    .from('records')
    .select('fields, brand_id')
    .eq('merchant_id', merchantId)
    .eq('index_name', indexName)
    .eq('object_id', objectId)
    .single()

  if (fetchError || !existing) {
    throw createError({ statusCode: 404, message: 'Record not found' })
  }

  // Merge fields
  const mergedFields = { ...(existing.fields as Record<string, unknown>), ...body.fields }

  await processRecords([{
    objectId,
    fields: mergedFields,
    merchantId,
    indexName,
    brandId: existing.brand_id as string | null
  }], supabase, openaiApiKey)

  return { objectId, indexName, status: 'updated' }
})
