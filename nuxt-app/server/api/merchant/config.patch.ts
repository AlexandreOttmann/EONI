import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { Merchant, MerchantConfigResponse, WidgetConfig } from '~/types/api'

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().url().optional(),
  widget_config: z.object({
    primary_color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    welcome_message: z.string().max(200).optional(),
    position: z.enum(['bottom-right', 'bottom-left']).optional()
  }).optional()
})

export default defineEventHandler(async (event): Promise<MerchantConfigResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readValidatedBody(event, bodySchema.parse)
  const client = await serverSupabaseServiceRole(event)

  const { data: existingRaw } = await client
    .from('merchants')
    .select('widget_config')
    .eq('id', user.id)
    .single()

  if (!existingRaw) throw createError({ statusCode: 404, message: 'Merchant not found' })

  const existingWidgetConfig = (existingRaw.widget_config ?? {}) as WidgetConfig

  // Merge widget_config; never allow client to overwrite widget_key
  const mergedWidgetConfig: WidgetConfig = body.widget_config
    ? {
        ...existingWidgetConfig,
        ...body.widget_config,
        widget_key: existingWidgetConfig.widget_key // preserve existing key
      }
    : existingWidgetConfig

  const updatePayload: Record<string, unknown> = {}
  if (body.name !== undefined) updatePayload.name = body.name
  if (body.domain !== undefined) updatePayload.domain = body.domain
  if (body.widget_config !== undefined) updatePayload.widget_config = mergedWidgetConfig

  const { data: updatedRaw, error } = await client
    .from('merchants')
    .update(updatePayload)
    .eq('id', user.id)
    .select('*')
    .single()

  if (error || !updatedRaw) throw createError({ statusCode: 500, message: 'Failed to update config' })
  return { merchant: updatedRaw as unknown as Merchant }
})
