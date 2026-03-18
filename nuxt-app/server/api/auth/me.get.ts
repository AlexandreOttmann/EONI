import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { MeResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const serviceClient = await serverSupabaseServiceRole(event)

  const { data: existing, error: selectError } = await serviceClient
    .from('merchants')
    .select('*')
    .eq('id', user.sub)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    throw createError({ statusCode: 500, message: 'Database error' })
  }

  if (existing) {
    return { merchant: existing as unknown as import('~/types/api').Merchant }
  }

  const { data: created, error: insertError } = await serviceClient
    .from('merchants')
    .insert({
      id: user.sub,
      email: user.email!,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'
    })
    .select()
    .single()

  if (insertError || !created) {
    throw createError({ statusCode: 500, message: 'Failed to provision merchant profile' })
  }

  return { merchant: created as unknown as import('~/types/api').Merchant }
})
