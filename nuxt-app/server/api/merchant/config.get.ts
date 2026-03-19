import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { Merchant, MerchantConfigResponse, WidgetConfig } from '~/types/api'
import type { Json } from '~/types/database.types'

export default defineEventHandler(async (event): Promise<MerchantConfigResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const client = await serverSupabaseServiceRole(event)
  const { data: rawMerchant, error } = await client
    .from('merchants')
    .select('*')
    .eq('id', user.sub)
    .single()

  if (error || !rawMerchant) throw createError({ statusCode: 404, message: 'Merchant not found' })

  let merchant = rawMerchant as unknown as Merchant

  // Auto-generate widget_key if missing
  if (!merchant.widget_config?.widget_key) {
    const widget_key = crypto.randomUUID()
    const mergedConfig: WidgetConfig = { ...(merchant.widget_config ?? {}), widget_key }
    const { data: updated } = await client
      .from('merchants')
      .update({ widget_config: mergedConfig as unknown as Json })
      .eq('id', user.sub)
      .select('*')
      .single()
    if (updated) merchant = updated as unknown as Merchant
  }

  return { merchant }
})
