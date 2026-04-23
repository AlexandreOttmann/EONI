import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { consola } from 'consola'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'
import { validateAndExtract } from '../../utils/rag-validator'
import { buildFactBasedPrompt, buildPrompt, buildAggregationPrompt } from '../../utils/prompt'

// ─── Singleton Anthropic client (R11) ────────────────────────
let _anthropic: Anthropic | null = null
function getAnthropicClient(apiKey: string): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey })
  return _anthropic
}

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  widget_key: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
})

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)

  const body = await readValidatedBody(event, bodySchema.parse)
  const { merchantId, widgetKey, merchant } = await resolveMerchant(event, client, body.widget_key)
  await rateLimitByKey(event, widgetKey, client)

  const sessionId = body.session_id ?? crypto.randomUUID()
  const startTime = Date.now()
  const merchantInfo = { name: merchant.name, domain: merchant.domain }

  // 1. Get context (intent-based retrieval + R7 cache + R5 reranking)
  const { conversationId, products, chunks, records, aggregationRecords, history, brandContext, queryIntent, allHighConfidence } = await buildChatContext(
    client,
    merchantId,
    merchantInfo,
    body.message,
    sessionId,
    config.openaiApiKey as string,
    body.brand_id,
  )

  // 2. R9b: Skip validation when all retrieved results are high-confidence.
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

  let text: string
  let confidenceScore: number

  // 4. Handle response based on validation
  if (!validation.answerable) {
    // Language-aware fallback via Sonnet
    const anthropic = getAnthropicClient(config.anthropicApiKey as string)
    const fallbackResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: `You are a helpful assistant for ${merchant.name}. Respond in the SAME language as the user's message. Politely tell the user you don't have enough information to answer their question from available sources.`,
      messages: [{ role: 'user', content: body.message }]
    })
    text = fallbackResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
    if (validation.suggestedProducts?.length) {
      text += '\n\n' + validation.suggestedProducts
        .map(p => `- **${p.name}** -- [View details](${p.source})`)
        .join('\n')
    }
    confidenceScore = 0
  } else {
    // Answerable — select prompt builder based on intent
    let system: string
    let messages: Anthropic.MessageParam[]
    let maxTokens = 1024

    if (queryIntent === 'aggregation') {
      // Full-catalog aggregation — bypassed vector search, all records available
      const aggPrompt = buildAggregationPrompt(merchantInfo, aggregationRecords, history, body.message, brandContext)
      system = aggPrompt.system
      messages = aggPrompt.messages
      maxTokens = 2048
    } else if (products.length > 0) {
      // Products found — use fact-based prompt
      const factPrompt = buildFactBasedPrompt(
        merchantInfo,
        validation.facts,
        products.map(p => ({ name: p.name, price: p.price, currency: p.currency, source_url: p.source_url, image_url: p.image_url ?? null })),
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

    const anthropic = getAnthropicClient(config.anthropicApiKey as string)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages
    })

    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    const confidenceMap = { high: 0.9, medium: 0.7, low: 0.4 } as const
    confidenceScore = confidenceMap[validation.confidence]
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
  if (userMsgError) throw createError({ statusCode: 500, message: 'Failed to persist user message' })

  // Persist assistant message with confidence from validation
  const { data: assistantMsg, error: assistantMsgError } = await client
    .from('messages')
    .insert({
      conversation_id: conversationId,
      merchant_id: merchantId,
      role: 'assistant',
      content: text,
      chunks_used: chunks.map(c => c.id),
      confidence_score: confidenceScore
    })
    .select('id')
    .single()
  if (assistantMsgError) throw createError({ statusCode: 500, message: 'Failed to persist assistant message' })

  return {
    text,
    sources: chunks,
    products,
    message_id: assistantMsg!.id,
    session_id: sessionId,
    conversation_id: conversationId
  }
})
