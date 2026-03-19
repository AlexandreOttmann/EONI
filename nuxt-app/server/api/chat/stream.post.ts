import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().min(1),
  widget_key: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)

  const body = await readValidatedBody(event, bodySchema.parse)
  const { merchantId, widgetKey, merchant } = await resolveMerchant(event, client, body.widget_key)
  rateLimitByKey(event, widgetKey)

  const stream = createEventStream(event)

  ;(async () => {
    try {
      const { conversationId, chunks, system, messages } = await buildChatContext(
        client,
        merchantId,
        { name: merchant.name, domain: merchant.domain },
        body.message,
        body.session_id,
        config.openaiApiKey as string
      )

      await stream.push({
        event: 'sources',
        data: JSON.stringify({ chunks })
      })

      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey as string })
      const anthropicStream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system,
        messages
      })

      let fullResponse = ''
      for await (const evt of anthropicStream) {
        if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta') {
          fullResponse += evt.delta.text
          await stream.push({ event: 'chunk', data: JSON.stringify({ text: evt.delta.text }) })
        }
      }

      const maxSimilarity = chunks.length > 0 ? Math.max(...chunks.map(c => c.similarity)) : null

      const { error: userMsgError } = await client.from('messages').insert({
        conversation_id: conversationId,
        merchant_id: merchantId,
        role: 'user',
        content: body.message,
        chunks_used: [],
        confidence_score: null
      })
      if (userMsgError) throw new Error(`Failed to persist user message: ${userMsgError.message}`)

      const { data: assistantMsg, error: assistantMsgError } = await client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          merchant_id: merchantId,
          role: 'assistant',
          content: fullResponse,
          chunks_used: chunks.map(c => c.id),
          confidence_score: maxSimilarity
        })
        .select('id')
        .single()
      if (assistantMsgError) throw new Error(`Failed to persist assistant message: ${assistantMsgError.message}`)

      await stream.push({ event: 'done', data: JSON.stringify({ message_id: assistantMsg?.id ?? null }) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream error'
      await stream.push({ event: 'error', data: JSON.stringify({ message }) })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
