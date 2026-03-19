import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  widget_key: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)

  const body = await readValidatedBody(event, bodySchema.parse)
  const { merchantId, widgetKey, merchant } = await resolveMerchant(event, client, body.widget_key)
  rateLimitByKey(event, widgetKey)

  const sessionId = body.session_id ?? crypto.randomUUID()

  const { conversationId, chunks, system, messages } = await buildChatContext(
    client,
    merchantId,
    { name: merchant.name, domain: merchant.domain },
    body.message,
    sessionId,
    config.openaiApiKey as string
  )

  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey as string })
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  const maxSimilarity = chunks.length > 0 ? Math.max(...chunks.map(c => c.similarity)) : null

  const { error: userMsgError } = await client.from('messages').insert({
    conversation_id: conversationId,
    merchant_id: merchantId,
    role: 'user',
    content: body.message,
    chunks_used: [],
    confidence_score: null
  })
  if (userMsgError) throw createError({ statusCode: 500, message: 'Failed to persist user message' })

  const { data: assistantMsg, error: assistantMsgError } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      merchant_id: merchantId,
      role: 'assistant',
      content: text,
      chunks_used: chunks.map(c => c.id),
      confidence_score: maxSimilarity
    })
    .select('id')
    .single()
  if (assistantMsgError) throw createError({ statusCode: 500, message: 'Failed to persist assistant message' })

  return {
    text,
    sources: chunks,
    message_id: assistantMsg!.id,
    session_id: sessionId,
    conversation_id: conversationId
  }
})
