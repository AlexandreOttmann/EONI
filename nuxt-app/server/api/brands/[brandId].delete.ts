import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'

const paramsSchema = z.object({
  brandId: z.string().uuid(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { brandId } = paramsSchema.parse({ brandId: getRouterParam(event, 'brandId') })
  const merchantId = user.sub
  const client = await serverSupabaseServiceRole(event)

  const { error, count } = await client
    .from('brands')
    .delete({ count: 'exact' })
    .eq('id', brandId)
    .eq('merchant_id', merchantId)

  if (error) {
    consola.error('Failed to delete brand', { merchantId, brandId, error: error.message })
    throw createError({ statusCode: 500, message: 'Failed to delete brand' })
  }

  if (count === 0) {
    throw createError({ statusCode: 404, message: 'Brand not found' })
  }

  consola.info('Brand deleted', { merchantId, brandId })
  setResponseStatus(event, 204)
  return null
})
