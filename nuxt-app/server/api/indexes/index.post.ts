// POST /api/indexes
// Register a new named index. The index starts empty; records are pushed separately.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'name must contain only letters, numbers, hyphens, or underscores',
  }),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const body = await readValidatedBody(event, bodySchema.parse)

  const supabase = await serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('indexes')
    .upsert({ merchant_id: merchantId, name: body.name }, { onConflict: 'merchant_id,name', ignoreDuplicates: true })
    .select('id, name, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Database error' })

  return { indexName: data.name, createdAt: data.created_at }
})
