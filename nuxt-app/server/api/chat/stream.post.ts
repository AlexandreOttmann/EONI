import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { consola } from 'consola'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'
import { validateAndExtract } from '../../utils/rag-validator'
import { buildFactBasedPrompt, buildPrompt } from '../../utils/prompt'

// ─── Singleton Anthropic client (R11) ────────────────────────
// Avoid constructing a new client on every request; reuse across handler calls.
let _anthropic: Anthropic | null = null
function getAnthropicClient(apiKey: string): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey })
  return _anthropic
}

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().min(1),
  widget_key: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)

  const body = await readValidatedBody(event, bodySchema.parse)
  const { merchantId, widgetKey, merchant } = await resolveMerchant(event, client, body.widget_key)
  await rateLimitByKey(event, widgetKey, client)

  const stream = createEventStream(event)

  ;(async () => {
    try {
      const startTime = Date.now()
      const merchantInfo = { name: merchant.name, domain: merchant.domain }

      // 1. Get context (intent-based retrieval + R7 cache + R5 reranking)
      const { conversationId, products, chunks, records, history, brandContext, queryIntent, allHighConfidence } = await buildChatContext(
        client,
        merchantId,
        merchantInfo,
        body.message,
        body.session_id,
        config.openaiApiKey as string,
        body.brand_id,
      )

      // 2. R9b: Skip validation when all retrieved results are high-confidence.
      //    Validation will almost certainly pass — this eliminates an LLM call
      //    for the majority of requests that have clear, high-similarity matches.
      const validation = allHighConfidence
        ? {
            answerable: true,
            confidence: 'high' as const,
            facts: [],
            missing: [],
          }
        : await validateAndExtract(
            config.openaiApiKey as string,
            body.message,
            products,
            chunks,
            records
          )

      // 3. Structured observability log
      consola.info({
        tag: 'rag-query',
        query: body.message,
        merchant_id: merchantId,
        products_retrieved: products.length,
        chunks_retrieved: chunks.length,
        records_retrieved: records.length,
        query_intent: queryIntent,
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

        // Generate language-aware fallback via Sonnet
        const anthropic = getAnthropicClient(config.anthropicApiKey as string)
        const fallbackStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          system: `You are a helpful assistant for ${merchant.name}. Respond in the SAME language as the user's message. Politely tell the user you don't have enough information to answer their question from available sources.`,
          messages: [
            ...history.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'user', content: body.message }
          ]
        })

        let fallback = ''
        for await (const evt of fallbackStream) {
          if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta') {
            fallback += evt.delta.text
            await stream.push({ event: 'chunk', data: JSON.stringify({ text: evt.delta.text }) })
          }
        }

        if (validation.suggestedProducts?.length) {
          const suggestions = '\n\n' + validation.suggestedProducts
            .map(p => `- **${p.name}** -- [View details](${p.source})`)
            .join('\n')
          fallback += suggestions
          await stream.push({ event: 'chunk', data: JSON.stringify({ text: suggestions }) })
        }

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
            body.message,
            brandContext,
            records
          )
          system = factPrompt.system
          messages = factPrompt.messages
        } else {
          // Chunks-only fallback — use original chunk-based prompt
          const chunkPrompt = buildPrompt(merchantInfo, chunks, history, body.message, brandContext, records)
          system = chunkPrompt.system
          messages = chunkPrompt.messages
        }

        await stream.push({
          event: 'sources',
          data: JSON.stringify({ chunks, products })
        })

        const anthropic = getAnthropicClient(config.anthropicApiKey as string)
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
