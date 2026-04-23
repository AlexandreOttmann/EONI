import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { consola } from 'consola'
import { embedTexts } from './embedder'
import { routeQuery, type QueryIntent } from './query-router'
import { rerankResults } from './reranker'

// ─── Per-intent similarity thresholds ───────────────────────
// Higher threshold for product queries to reduce irrelevant results.
// Lower threshold for support/general where partial matches are useful.
const SIMILARITY_THRESHOLDS: Record<QueryIntent, number> = {
  product: 0.45,
  brand:   0.35,
  support: 0.30,
  general: 0.30,
  aggregation: 0, // unused — aggregation bypasses vector search entirely
}

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

export interface RecordResult {
  id: string
  object_id: string
  index_name: string
  fields: Record<string, unknown>
  similarity: number
  rrf_score: number
  neighbors?: Array<Record<string, unknown>>
}

export interface AggregationRecord {
  object_id: string
  fields: Record<string, unknown>
  searchable_text: string
}

export interface ChatContext {
  conversationId: string
  products: ProductResult[]
  chunks: ChunkResult[]
  records: RecordResult[]
  /** Populated only when queryIntent === 'aggregation' — full catalog scan results */
  aggregationRecords: AggregationRecord[]
  queryEmbedding: number[]
  history: HistoryMessage[]
  brandContext: string | null
  queryIntent: QueryIntent
  /** R9b: true when all retrieved results are high-confidence — validation LLM call can be skipped */
  allHighConfidence: boolean
}

// ─── Rate limiter (Supabase-backed, multi-instance safe) ────
//
// Replaces the previous in-memory Map which reset on server restart and
// did not work across multiple server instances. Uses an atomic Postgres
// function (increment_rate_limit) with FOR UPDATE to prevent race conditions.

export async function rateLimitByKey(
  event: H3Event,
  key: string,
  supabase: SupabaseClient,
  limit = 20,
  windowMs = 60_000
): Promise<void> {
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_key: `chat:${key}`,
    p_window_ms: windowMs,
    p_max_requests: limit,
  })

  if (error) {
    // Log and allow — don't block legitimate requests on rate-limit infra failures
    consola.warn({ tag: 'rate-limit', message: 'Rate limit check failed, allowing request', error: error.message })
    return
  }

  const allowed = (data as Array<{ allowed: boolean }>)?.[0]?.allowed ?? true
  if (!allowed) {
    setResponseHeader(event, 'Retry-After', 60)
    throw createError({ statusCode: 429, message: 'Rate limit exceeded. Try again in 60 seconds.' })
  }
}

// ─── R7: Query cache helpers ────────────────────────────────
// Cache TTL (ms) — must match the SQL default interval (10 minutes)
const CACHE_TTL_MS = 10 * 60 * 1000

// R9b: Similarity threshold above which validation is skipped
const MIN_SIMILARITY_FOR_SKIP_VALIDATION = 0.72

/**
 * Derive a short, stable cache key from the first 64 floats of an embedding.
 * 64 values give enough entropy for a unique fingerprint without hashing all 1536.
 */
function embeddingCacheKey(embedding: number[]): string {
  return createHash('sha256')
    .update(embedding.slice(0, 64).join(','))
    .digest('hex')
    .slice(0, 32)
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

// ─── Chat context builder (intent-based retrieval) ──────────

export async function buildChatContext(
  supabase: SupabaseClient,
  merchantId: string,
  _merchantInfo: { name: string, domain: string },
  message: string,
  sessionId: string,
  openaiApiKey: string,
  brandId?: string,
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
    const insertData: Record<string, unknown> = { merchant_id: merchantId, session_id: sessionId, source: 'widget' }
    if (brandId) insertData.brand_id = brandId
    const { data: newConv } = await supabase
      .from('conversations')
      .insert(insertData)
      .select('id')
      .single()
    if (!newConv) throw new Error('Failed to create conversation')
    conversationId = newConv.id
  }

  // Fetch last 6 messages
  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(6)

  if (historyError) {
    consola.warn({ tag: 'chat-history', error: historyError.message, conversationId, merchantId })
  }
  const history = (historyRows ?? []).reverse() as HistoryMessage[]
  consola.debug({ tag: 'chat-history', count: history.length, conversationId })

  // Run query routing (intent + targetIndex) + embedding in parallel
  const [routerResult, embedResults] = await Promise.all([
    routeQuery(message, openaiApiKey, _merchantInfo.name),
    embedTexts([message], openaiApiKey)
  ])

  const { intent: queryIntent } = routerResult
  let targetIndex: string | null = routerResult.targetIndex
  const queryEmbedding = embedResults[0]
  if (!queryEmbedding) throw new Error('Failed to generate query embedding')

  // Fallback: if the router picked a specific index but no registration exists
  // for this (merchant, brand, index) triple, drop back to null so search
  // sees every index. Prevents empty-result dead-ends when e.g. the router
  // routes "what's your return policy" to `support` but the merchant hasn't
  // crawled any support pages yet.
  let targetIndexFallback = false
  if (targetIndex !== null) {
    const { data: indexRow } = await supabase
      .from('indexes')
      .select('name')
      .eq('merchant_id', merchantId)
      .eq('brand_id', brandId ?? null)
      .eq('name', targetIndex)
      .limit(1)
      .maybeSingle()
    if (!indexRow) {
      targetIndexFallback = true
      targetIndex = null
    }
  }
  consola.debug({
    tag: 'query-route',
    intent: queryIntent,
    targetIndex,
    fallback: targetIndexFallback,
  })

  // Fetch brand description if brandId is set
  let brandContext: string | null = null
  if (brandId) {
    const { data: brand } = await supabase
      .from('brands')
      .select('description, extracted_description')
      .eq('id', brandId)
      .eq('merchant_id', merchantId)
      .single()
    if (brand) {
      brandContext = brand.description || brand.extracted_description || null
    }
  }

  // ─── Aggregation fast path ──────────────────────────────────
  // Skip vector search, reranking, caching, and RAG validation entirely.
  // list_records_for_aggregation does a full catalog scan (up to 150 records).
  if (queryIntent === 'aggregation') {
    const { data: aggData, error: aggError } = await supabase.rpc('list_records_for_aggregation', {
      p_merchant_id: merchantId,
      p_index_name: targetIndex,
      p_brand_id: brandId ?? null,
      p_limit: 150,
    })
    if (aggError) {
      consola.error({ tag: 'list_records_for_aggregation', error: aggError.message, merchantId })
    }
    const aggregationRecords = (aggData ?? []) as AggregationRecord[]
    consola.debug({ tag: 'aggregation', records: aggregationRecords.length, merchantId })

    return {
      conversationId,
      products: [],
      chunks: [],
      records: [],
      aggregationRecords,
      queryEmbedding,
      history,
      brandContext,
      queryIntent,
      allHighConfidence: true, // skip RAG validator; full catalog provided
    }
  }

  // ─── R7: Check query cache ───────────────────────────────
  const cacheKey = embeddingCacheKey(queryEmbedding)
  const { data: cachedRow } = await supabase
    .from('query_cache')
    .select('context_json')
    .eq('merchant_id', merchantId)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cachedRow?.context_json) {
    consola.debug({ tag: 'query-cache', hit: true, merchantId, cacheKey })
    const cached = cachedRow.context_json as { chunks: ChunkResult[], records: RecordResult[], products: ProductResult[] }
    return {
      conversationId,
      products: cached.products ?? [],
      chunks: cached.chunks ?? [],
      records: cached.records ?? [],
      aggregationRecords: [],
      queryEmbedding,
      history,
      brandContext,
      queryIntent,
      allHighConfidence: true, // cached results were already validated — skip validation again
    }
  }
  consola.debug({ tag: 'query-cache', hit: false, merchantId, cacheKey })

  // Intent-based retrieval strategy — per-intent similarity threshold (R6)
  const products: ProductResult[] = []
  const embeddingParam = queryEmbedding as unknown as string
  const matchThreshold = SIMILARITY_THRESHOLDS[queryIntent]

  // R10: Parallelize chunk retrieval + records retrieval (independent queries)
  // This saves 50-100ms per request vs. sequential execution.
  // Using async IIFEs to get native Promises (supabase.rpc returns PromiseLike).
  const chunkQueryPromise: Promise<ChunkResult[]> = (async () => {
    if (queryIntent === 'product') {
      const { data, error } = await supabase.rpc('match_chunks_by_type', {
        query_embedding: embeddingParam,
        match_threshold: matchThreshold,
        match_count: 8,
        p_merchant_id: merchantId,
        p_brand_id: brandId ?? null,
        p_content_types: ['product'],
      })
      if (error) consola.error({ tag: 'match_chunks_by_type', error: error.message, code: error.code, merchantId })
      return (data ?? []) as ChunkResult[]
    }
    if (queryIntent === 'brand') {
      const { data, error } = await supabase.rpc('match_chunks_by_type', {
        query_embedding: embeddingParam,
        match_threshold: matchThreshold,
        match_count: 8,
        p_merchant_id: merchantId,
        p_brand_id: brandId ?? null,
        p_content_types: ['brand'],
      })
      if (error) consola.error({ tag: 'match_chunks_by_type', error: error.message, code: error.code, merchantId })
      return (data ?? []) as ChunkResult[]
    }
    if (queryIntent === 'support') {
      const { data, error } = await supabase.rpc('match_chunks_by_type', {
        query_embedding: embeddingParam,
        match_threshold: matchThreshold,
        match_count: 8,
        p_merchant_id: merchantId,
        p_brand_id: brandId ?? null,
        p_content_types: ['faq', 'support'],
      })
      if (error) consola.error({ tag: 'match_chunks_by_type', error: error.message, code: error.code, merchantId })
      return (data ?? []) as ChunkResult[]
    }
    // general — fetch chunks across all types
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: embeddingParam,
      match_threshold: matchThreshold,
      match_count: 8,
      p_merchant_id: merchantId,
    })
    if (error) consola.error({ tag: 'match_chunks', error: error.message, code: error.code, merchantId })
    return (data ?? []) as ChunkResult[]
  })()

  const recordsQueryPromise: Promise<RecordResult[]> = (async () => {
    const { data, error } = await supabase.rpc('match_records_hybrid', {
      query_embedding: embeddingParam,
      query_text: message,
      match_count: 8,
      p_merchant_id: merchantId,
      p_index_name: targetIndex,
      p_brand_id: brandId ?? null,
    })
    if (error) consola.error({ tag: 'match_records_hybrid', error: error.message, code: error.code, merchantId })
    return (data ?? []) as RecordResult[]
  })()

  // Fire both queries in parallel
  const [rawChunks, rawRecords] = await Promise.all([chunkQueryPromise, recordsQueryPromise])

  // ─── R5: Reranking stage ─────────────────────────────────
  // Collect all chunk + record content into a flat array for the reranker.
  // Reranker returns top-5 indexes from the combined list.
  // Falls back to original order silently if JINA_API_KEY is missing or times out.
  const allDocuments: string[] = [
    ...rawChunks.map(c => c.content),
    ...rawRecords.map(r => Object.values(r.fields).join(' ')),
  ]
  const rankedIndexes = await rerankResults(message, allDocuments, 5)

  const chunkCount = rawChunks.length
  const chunks: ChunkResult[] = []
  const rerankedRecords: RecordResult[] = []

  for (const idx of rankedIndexes) {
    if (idx < chunkCount) {
      const c = rawChunks[idx]
      if (c) chunks.push(c)
    } else {
      const r = rawRecords[idx - chunkCount]
      if (r) rerankedRecords.push(r)
    }
  }

  // Any items not selected by reranker are dropped (top-5 total).
  // If reranker returned no indexes (empty), fall back to originals.
  const finalChunks = chunks.length > 0 ? chunks : rawChunks.slice(0, 5)
  const topRecords: RecordResult[] = rerankedRecords.length > 0 ? rerankedRecords : rawRecords.slice(0, 5)

  // Fetch 1-hop neighbors for top records
  if (topRecords.length > 0) {
    const topIds = topRecords.map(r => r.id)
    const { data: edgeRows } = await supabase
      .from('record_edges')
      .select('source_record_id, target_record_id')
      .eq('merchant_id', merchantId)
      .in('source_record_id', topIds)

    if (edgeRows && edgeRows.length > 0) {
      const neighborIds = [...new Set(edgeRows.map(e => e.target_record_id as string).filter(id => !topIds.includes(id)))]
      if (neighborIds.length > 0) {
        const { data: neighborRecords } = await supabase
          .from('records')
          .select('id, fields')
          .eq('merchant_id', merchantId)
          .in('id', neighborIds)
          .limit(10)

        const neighborMap = new Map((neighborRecords ?? []).map(r => [r.id as string, r.fields as Record<string, unknown>]))
        for (const rec of topRecords) {
          const recNeighborIds = edgeRows.filter(e => e.source_record_id === rec.id).map(e => e.target_record_id as string)
          rec.neighbors = recNeighborIds.map(id => neighborMap.get(id)).filter(Boolean) as Array<Record<string, unknown>>
        }
      }
    }
  }

  // ─── R9b: High-confidence skip + R7: Cache write ─────────
  // If all top results exceed the retrieval threshold, validation will
  // almost certainly pass — skip the extra LLM call and cache the result.
  const allHighConfidence = finalChunks.length > 0 &&
    finalChunks.every(c => c.similarity >= MIN_SIMILARITY_FOR_SKIP_VALIDATION) &&
    (topRecords.length === 0 || topRecords.every(r => r.similarity >= MIN_SIMILARITY_FOR_SKIP_VALIDATION))

  if (allHighConfidence) {
    consola.debug({ tag: 'rag-validator', skip: true, reason: 'all-high-confidence', merchantId })
  }

  // Write to cache regardless of whether validation was skipped.
  // The consumer (stream.post.ts) can still call validateAndExtract if needed
  // based on the allHighConfidence flag, but the retrieval result is cached.
  const contextToCache = { chunks: finalChunks, records: topRecords, products }
  supabase
    .from('query_cache')
    .upsert(
      {
        merchant_id: merchantId,
        cache_key: cacheKey,
        context_json: contextToCache,
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: 'merchant_id,cache_key' }
    )
    .then(({ error }) => {
      if (error) consola.warn({ tag: 'query-cache', message: 'Cache write failed', error: error.message })
    })

  return { conversationId, products, chunks: finalChunks, records: topRecords, aggregationRecords: [], queryEmbedding, history, brandContext, queryIntent, allHighConfidence }
}
