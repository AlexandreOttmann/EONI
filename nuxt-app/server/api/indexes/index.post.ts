// POST /api/indexes
// Register a new named index scoped to a specific brand. The index starts
// empty; records are pushed separately.
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'name must contain only letters, numbers, hyphens, or underscores',
  }),
  brand_id: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const merchantId = user.sub

  const body = await readValidatedBody(event, bodySchema.parse)

  const supabase = await serverSupabaseServiceRole(event)

  // Verify brand ownership — never trust client-provided brand_id alone.
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id')
    .eq('id', body.brand_id)
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (brandError) throw createError({ statusCode: 500, message: 'Database error' })
  if (!brand) throw createError({ statusCode: 404, message: 'Brand not found' })

  const { data, error } = await supabase
    .from('indexes')
    .upsert(
      { merchant_id: merchantId, brand_id: body.brand_id, name: body.name },
      { onConflict: 'merchant_id,brand_id,name', ignoreDuplicates: true }
    )
    .select('id, name, brand_id, created_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: 'Database error' })

  return {
    indexName: data.name,
    brandId: data.brand_id as string | null,
    createdAt: data.created_at,
  }
})
