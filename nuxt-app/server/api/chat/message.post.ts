import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { consola } from 'consola'
import { resolveMerchant, rateLimitByKey, buildChatContext } from '../../utils/chat'
import { validateAndExtract } from '../../utils/rag-validator'
import { buildFactBasedPrompt, buildPrompt } from '../../utils/prompt'

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
  const startTime = Date.now()
  const merchantInfo = { name: merchant.name, domain: merchant.domain }

  // 1. Get context (products-first, chunks-fallback)
  const { conversationId, products, chunks, history } = await buildChatContext(
    client,
    merchantId,
    merchantInfo,
    body.message,
    sessionId,
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

  let text: string
  let confidenceScore: number

  // 4. Handle response based on validation
  if (!validation.answerable) {
    // Soft fallback — no Sonnet call
    text = 'I don\'t have enough information from the available sources to answer that question.'
    if (validation.suggestedProducts?.length) {
      text += '\n\nHowever, here are some options that might be relevant:\n'
      text += validation.suggestedProducts
        .map(p => `- **${p.name}** -- [View details](${p.source})`)
        .join('\n')
    }
    confidenceScore = 0
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

    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey as string })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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
