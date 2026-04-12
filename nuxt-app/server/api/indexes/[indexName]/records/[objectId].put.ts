// PUT /api/indexes/:indexName/records/:objectId
// Full upsert — replaces the record's fields entirely and re-embeds.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

import { z } from 'zod'

const bodySchema = z.object({
  // Zod v4 requires two arguments for z.record(): z.record(keySchema, valueSchema)
  fields: z.record(z.string(), recordValueSchema),
  brand_id: z.string().uuid().optional()
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

  await processRecords([{
    objectId,
    fields: body.fields,
    merchantId,
    indexName,
    brandId: body.brand_id ?? null
  }], supabase, openaiApiKey)

  return { objectId, indexName, status: 'updated' }
})
