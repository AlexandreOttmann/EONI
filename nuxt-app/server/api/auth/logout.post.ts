import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import type { LogoutResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<LogoutResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const client = await serverSupabaseClient(event)
  const { error } = await client.auth.signOut()

  if (error) {
    throw createError({ statusCode: 500, message: 'Logout failed' })
  }

  return { success: true }
})
