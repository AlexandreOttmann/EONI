import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { MeResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: merchant, error } = await serviceClient
    .from('merchants')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !merchant) {
    throw createError({ statusCode: 404, message: 'Merchant profile not found' })
  }

  return { merchant: merchant as unknown as import('~/types/api').Merchant }
})
