import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { SignupResponse } from '~/types/api'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  domain: z.string().url().optional()
})

export default defineEventHandler(async (event): Promise<SignupResponse> => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const client = await serverSupabaseClient(event)
  const serviceClient = await serverSupabaseServiceRole(event)

  // 1. Create auth user
  const { data: authData, error: authError } = await client.auth.signUp({
    email: body.email,
    password: body.password
  })

  if (authError || !authData.user) {
    throw createError({ statusCode: 400, message: 'Could not create account' })
  }

  // 2. Insert merchant row — must use service role to write immediately
  //    (auth user exists but JWT not yet confirmed in this request)
  const { data: merchant, error: merchantError } = await serviceClient
    .from('merchants')
    .insert({
      id: authData.user.id,
      email: body.email,
      name: body.name,
      domain: body.domain ?? null
    })
    .select()
    .single()

  if (merchantError || !merchant) {
    // Rollback: delete the auth user we just created to avoid orphaned accounts
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    throw createError({ statusCode: 500, message: 'Failed to create merchant profile' })
  }

  return {
    user: {
      id: authData.user.id,
      email: authData.user.email!
    },
    merchant: merchant as unknown as import('~/types/api').Merchant
  }
})
