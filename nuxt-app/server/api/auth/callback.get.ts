import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string | undefined

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing OAuth code' })
  }

  const client = await serverSupabaseClient(event)
  const { data, error } = await client.auth.exchangeCodeForSession(code)

  if (error || !data.user || !data.user.email) {
    throw createError({ statusCode: 400, message: 'OAuth authentication failed' })
  }

  // Ensure a merchants row exists for this user.
  // Google OAuth users bypass signup.post.ts so we provision here via upsert.
  const serviceClient = serverSupabaseServiceRole(event)
  const email = data.user.email as string
  const meta = data.user.user_metadata as Record<string, string> | undefined
  const name = (meta?.full_name ?? meta?.name ?? email.split('@')[0]) as string

  const { error: upsertError } = await serviceClient
    .from('merchants')
    .upsert(
      { id: data.user.id, email: email, name },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  if (upsertError) {
    // Non-fatal: log and continue — user can still reach the dashboard,
    // but degraded (no merchant profile). Surface in monitoring.
    console.error('[auth/callback] merchant upsert failed', upsertError.message)
  }

  return sendRedirect(event, '/dashboard')
})
