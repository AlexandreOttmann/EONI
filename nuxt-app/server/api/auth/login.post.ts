import { z } from 'zod'
import { serverSupabaseClient } from '#supabase/server'
import type { LoginResponse } from '~/types/api'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event): Promise<LoginResponse> => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const client = await serverSupabaseClient(event)

  const { data, error } = await client.auth.signInWithPassword({
    email: body.email,
    password: body.password
  })

  if (error || !data.user || !data.session) {
    throw createError({ statusCode: 401, message: 'Invalid email or password' })
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email!
    },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? 0
    }
  }
})
