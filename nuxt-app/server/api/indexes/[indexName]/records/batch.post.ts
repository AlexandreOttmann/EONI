// POST /api/indexes/:indexName/records/batch
// Batch upsert up to 1000 records. Each item is { objectID, ...fields }.
// Returns a task descriptor immediately; processing is synchronous.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

import { z } from 'zod'
import { randomUUID } from 'uncrypto'

const bodySchema = z.array(
  z.record(z.string(), z.unknown()).refine(
    r => typeof r['objectID'] === 'string' && (r['objectID'] as string).length > 0,
    { message: 'Each record must have a string objectID field' }
  )
).min(1).max(1000)

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const indexName = validateIndexName(getRouterParam(event, 'indexName'))

  const rawBody = await readBody(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid request body' })
  }
  const rawRecords = parsed.data

  const openaiApiKey = useRuntimeConfig().openaiApiKey as string
  if (!openaiApiKey) throw createError({ statusCode: 500, message: 'OpenAI API key not configured' })

  const supabase = await serverSupabaseServiceRole(event)

  const query = getQuery(event)
  const brandId = typeof query.brand_id === 'string' && query.brand_id ? query.brand_id : null

  const records = rawRecords.map((raw) => {
    const { objectID, ...rest } = raw as Record<string, unknown>
    return {
      objectId: objectID as string,
      fields: rest,
      merchantId,
      indexName,
      brandId
    }
  })

  await processRecords(records, supabase, openaiApiKey)

  return {
    taskID: randomUUID(),
    indexName,
    objectsCount: records.length,
    status: 'processed'
  }
})
