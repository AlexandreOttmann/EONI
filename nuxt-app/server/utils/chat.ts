import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { consola } from 'consola'
import { embedTexts } from './embedder'

// ─── Types ──────────────────────────────────────────────────

export interface ProductResult {
  id: string
  name: string
  description: string | null
  price: number | null
  currency: string
  availability: string
  category: string | null
  source_url: string
  image_url: string | null
  similarity: number
}

export interface ChunkResult {
  id: string
  content: string
  similarity: number
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContext {
  conversationId: string
  products: ProductResult[]
  chunks: ChunkResult[]
  queryEmbedding: number[]
  history: HistoryMessage[]
}

// ─── Rate limiter ───────────────────────────────────────────

// In-memory rate limiter shared across both chat endpoints
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

export function rateLimitByKey(event: H3Event, key: string, limit = 20, windowMs = 60_000): void {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  if (entry.count >= limit) {
    setResponseHeader(event, 'Retry-After', 60)
    throw createError({ statusCode: 429, message: 'Rate limit exceeded. Try again in 60 seconds.' })
  }
  entry.count++
}

// ─── Merchant resolution ────────────────────────────────────

export async function resolveMerchant(
  event: H3Event,
  supabase: SupabaseClient,
  bodyWidgetKey?: string
): Promise<{ merchantId: string, widgetKey: string, merchant: { id: string, name: string, domain: string, widget_config: Record<string, unknown> } }> {
  const authHeader = getHeader(event, 'authorization')
  let widgetKey: string | undefined

  if (authHeader?.startsWith('Bearer ')) {
    widgetKey = authHeader.slice(7).trim()
  } else {
    widgetKey = bodyWidgetKey
  }

  if (!widgetKey) {
    throw createError({ statusCode: 401, message: 'Missing widget key' })
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, name, domain, widget_config')
    .filter('widget_config->>widget_key', 'eq', widgetKey)
    .single()

  if (!merchant) throw createError({ statusCode: 401, message: 'Invalid widget key' })

  return { merchantId: merchant.id, widgetKey, merchant }
}

// ─── Chat context builder (products-first retrieval) ────────

export async function buildChatContext(
  supabase: SupabaseClient,
  merchantId: string,
  _merchantInfo: { name: string, domain: string },
  message: string,
  sessionId: string,
  openaiApiKey: string
): Promise<ChatContext> {
  // Lookup or create conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  let conversationId: string
  if (existingConv) {
    conversationId = existingConv.id
  } else {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ merchant_id: merchantId, session_id: sessionId, source: 'widget' })
      .select('id')
      .single()
    if (!newConv) throw new Error('Failed to create conversation')
    conversationId = newConv.id
  }

  // Fetch last 6 messages
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(6)

  const history = (historyRows ?? []).reverse() as HistoryMessage[]

  // Embed user message
  const embedResults = await embedTexts([message], openaiApiKey)
  const queryEmbedding = embedResults[0]
  if (!queryEmbedding) throw new Error('Failed to generate query embedding')

  // 1. Search products FIRST (top 3, threshold 0.35)
  // Note: text-embedding-3-small produces lower cosine scores than expected (~0.3-0.5 for relevant content)
  const { data: productResults, error: productError } = await supabase.rpc('match_products', {
    query_embedding: queryEmbedding as unknown as string,
    match_threshold: 0.35,
    match_count: 3,
    p_merchant_id: merchantId
  })
  if (productError) {
    consola.error({ tag: 'match_products', error: productError.message, code: productError.code, merchantId })
  }
  const products: ProductResult[] = productResults ?? []

  // 2. Fallback to chunks ONLY if no products found (top 5, threshold 0.35)
  let chunks: ChunkResult[] = []
  if (products.length === 0) {
    const { data: chunkResults, error: chunkError } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding as unknown as string,
      match_threshold: 0.35,
      match_count: 5,
      p_merchant_id: merchantId
    })
    if (chunkError) {
      consola.error({ tag: 'match_chunks', error: chunkError.message, code: chunkError.code, merchantId })
    }
    chunks = chunkResults ?? []
  }

  return { conversationId, products, chunks, queryEmbedding, history }
}
