import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { consola } from 'consola'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'
import { validateAndExtract } from '../../utils/rag-validator'
import { buildFactBasedPrompt, buildPrompt } from '../../utils/prompt'

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
      const startTime = Date.now()
      const merchantInfo = { name: merchant.name, domain: merchant.domain }

      // 1. Get context (products-first, chunks-fallback)
      const { conversationId, products, chunks, history } = await buildChatContext(
        client,
        merchantId,
        merchantInfo,
        body.message,
        body.session_id,
        config.openaiApiKey as string
      )

      // 2. Validate + extract facts (Haiku, ~300ms)
      const validation = await validateAndExtract(
        config.anthropicApiKey as string,
        body.message,
        products,
        chunks
      )

      // 3. Structured observability log
      consola.info({
        tag: 'rag-query',
        query: body.message,
        merchant_id: merchantId,
        products_retrieved: products.length,
        chunks_retrieved: chunks.length,
        answerable: validation.answerable,
        confidence: validation.confidence,
        missing: validation.missing,
        latency_ms: Date.now() - startTime
      })

      // 4. Handle response based on validation
      if (!validation.answerable) {
        // Soft fallback — no Sonnet call
        await stream.push({
          event: 'sources',
          data: JSON.stringify({ chunks: [], products })
        })

        let fallback = 'I don\'t have enough information from the available sources to answer that question.'
        if (validation.suggestedProducts?.length) {
          fallback += '\n\nHowever, here are some options that might be relevant:\n'
          fallback += validation.suggestedProducts
            .map(p => `- **${p.name}** -- [View details](${p.source})`)
            .join('\n')
        }

        await stream.push({ event: 'chunk', data: JSON.stringify({ text: fallback }) })

        // Persist user message
        const { error: userMsgError } = await client.from('messages').insert({
          conversation_id: conversationId,
          merchant_id: merchantId,
          role: 'user',
          content: body.message,
          chunks_used: [],
          confidence_score: null
        })
        if (userMsgError) throw new Error(`Failed to persist user message: ${userMsgError.message}`)

        // Persist assistant fallback message
        const { data: assistantMsg, error: assistantMsgError } = await client
          .from('messages')
          .insert({
            conversation_id: conversationId,
            merchant_id: merchantId,
            role: 'assistant',
            content: fallback,
            chunks_used: [],
            confidence_score: 0
          })
          .select('id')
          .single()
        if (assistantMsgError) throw new Error(`Failed to persist assistant message: ${assistantMsgError.message}`)

        await stream.push({ event: 'done', data: JSON.stringify({ message_id: assistantMsg?.id ?? null }) })
      } else {
        // Answerable — fact-based prompt via Sonnet
        let system: string
        let messages: Anthropic.MessageParam[]

        if (products.length > 0) {
          // Products found — use fact-based prompt
          const factPrompt = buildFactBasedPrompt(
            merchantInfo,
            validation.facts,
            products.map(p => ({ name: p.name, price: p.price, currency: p.currency, source_url: p.source_url })),
            history,
            body.message
          )
          system = factPrompt.system
          messages = factPrompt.messages
        } else {
          // Chunks-only fallback — use original chunk-based prompt
          const chunkPrompt = buildPrompt(merchantInfo, chunks, history, body.message)
          system = chunkPrompt.system
          messages = chunkPrompt.messages
        }

        await stream.push({
          event: 'sources',
          data: JSON.stringify({ chunks, products })
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

        // Derive confidence score from validation
        const confidenceMap = { high: 0.9, medium: 0.7, low: 0.4 } as const
        const confidenceScore = confidenceMap[validation.confidence]

        // Persist user message
        const { error: userMsgError } = await client.from('messages').insert({
          conversation_id: conversationId,
          merchant_id: merchantId,
          role: 'user',
          content: body.message,
          chunks_used: [],
          confidence_score: null
        })
        if (userMsgError) throw new Error(`Failed to persist user message: ${userMsgError.message}`)

        // Persist assistant message with confidence from validation
        const { data: assistantMsg, error: assistantMsgError } = await client
          .from('messages')
          .insert({
            conversation_id: conversationId,
            merchant_id: merchantId,
            role: 'assistant',
            content: fullResponse,
            chunks_used: chunks.map(c => c.id),
            confidence_score: confidenceScore
          })
          .select('id')
          .single()
        if (assistantMsgError) throw new Error(`Failed to persist assistant message: ${assistantMsgError.message}`)

        await stream.push({ event: 'done', data: JSON.stringify({ message_id: assistantMsg?.id ?? null }) })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream error'
      await stream.push({ event: 'error', data: JSON.stringify({ message }) })
    } finally {
      await stream.close()
    }
  })()

  return stream.send()
})
