import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { embedTexts } from '../../utils/embedder'
import { buildPrompt } from '../../utils/prompt'

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().min(1),
  widget_key: z.string().uuid()
})

// In-memory rate limiter: 20 requests per minute per widget_key
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  if (!checkRateLimit(body.widget_key)) {
    setResponseHeader(event, 'Retry-After', 60)
    throw createError({ statusCode: 429, message: 'Rate limit exceeded. Try again in 60 seconds.' })
  }

  const client = await serverSupabaseServiceRole(event)
  const config = useRuntimeConfig(event)

  // Resolve merchant from widget_key — merchant_id is always derived server-side
  const { data: merchant } = await client
    .from('merchants')
    .select('id, name, domain, widget_config')
    .filter('widget_config->>widget_key', 'eq', body.widget_key)
    .single()

  if (!merchant) throw createError({ statusCode: 401, message: 'Invalid widget key' })

  const merchantId: string = merchant.id
  const stream = createEventStream(event)

  ;(async () => {
    try {
      // Look up existing conversation for this session
      const { data: existingConv } = await client
        .from('conversations')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('session_id', body.session_id)
        .maybeSingle()

      let conversationId: string
      if (existingConv) {
        conversationId = existingConv.id
      } else {
        const { data: newConv } = await client
          .from('conversations')
          .insert({ merchant_id: merchantId, session_id: body.session_id, source: 'widget' })
          .select('id')
          .single()
        if (!newConv) throw new Error('Failed to create conversation')
        conversationId = newConv.id
      }

      // Fetch last 6 messages for context (oldest first after reversing)
      const { data: historyRows } = await client
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(6)

      const history = (historyRows ?? []).reverse() as Array<{ role: 'user' | 'assistant', content: string }>

      // Embed the user message for vector search
      const embedResults = await embedTexts([body.message], config.openaiApiKey as string)
      const queryEmbedding = embedResults[0]
      if (!queryEmbedding) throw new Error('Failed to generate query embedding')

      // pgvector similarity search scoped to merchant
      // DB stub types query_embedding as string; cast for pgvector compatibility
      const { data: chunkResults } = await client.rpc('match_chunks', {
        query_embedding: queryEmbedding as unknown as string,
        match_threshold: 0.72,
        match_count: 8,
        p_merchant_id: merchantId
      })

      const chunks: Array<{ id: string, content: string, similarity: number }> = chunkResults ?? []

      // Persist user message before LLM call so it's saved even if inference fails
      const { error: userMsgError } = await client.from('messages').insert({
        conversation_id: conversationId,
        merchant_id: merchantId,
        role: 'user',
        content: body.message,
        chunks_used: [],
        confidence_score: null
      })
      if (userMsgError) throw new Error(`Failed to persist user message: ${userMsgError.message}`)

      // Send retrieved sources to client before streaming starts
      await stream.push({
        event: 'sources',
        data: JSON.stringify({ chunks })
      })

      // Assemble prompt and stream from Claude
      const { system, messages } = buildPrompt(
        { name: merchant.name, domain: merchant.domain },
        chunks,
        history,
        body.message
      )

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

      const maxSimilarity = chunks.length > 0
        ? Math.max(...chunks.map(c => c.similarity))
        : null

      // Persist assistant message
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
