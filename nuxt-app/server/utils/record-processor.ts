import type { SupabaseClient } from '@supabase/supabase-js'
import { consola } from 'consola'
import { embedTexts } from './embedder'

// ─── Types ────────────────────────────────────────────────────

export interface RecordInput {
  objectId: string
  fields: Record<string, unknown>
  merchantId: string
  indexName: string
  brandId?: string | null
}

// Field keys used to build searchable text, in priority order
const TITLE_KEYS       = ['name', 'title', 'destination']
const NARRATIVE_KEYS   = ['page_context', 'description', 'body', 'content']
const SKIP_KEYS        = new Set([
  ...['name', 'title', 'destination', 'page_context', 'description', 'body', 'content'],
  'extraction_confidence', 'missing_fields', 'crawl_job_id', 'page_id',
  'source_url', 'image_url', 'sku',
])
const EDGE_FIELD_KEYS  = ['category', 'brand', 'collection']

// Unit patterns for numeric fields → natural language
const UNIT_PATTERNS: Record<string, (v: number) => string> = {
  price_usd: v => `$${v} USD`,
  price_eur: v => `${v}€`,
  price: v => `${v}`,
  duration_days: v => `${v} days`,
  duration_hours: v => `${v} hours`,
  weight_kg: v => `${v} kg`,
  weight_g: v => `${v}g`,
  rating: v => `rated ${v}/5`,
}

// ─── buildSearchableText (natural language) ──────────────────

export function buildSearchableText(
  objectId: string,
  fields: Record<string, unknown>
): string {
  const sentences: string[] = []

  // 1. Title — value only, no key prefix
  for (const key of TITLE_KEYS) {
    const val = fields[key]
    if (typeof val === 'string' && val.trim()) {
      sentences.push(val.trim())
      break // use first available title
    }
  }

  // 2. Narrative fields — value only (already natural language)
  for (const key of NARRATIVE_KEYS) {
    const val = fields[key]
    if (typeof val === 'string' && val.trim()) {
      sentences.push(val.trim())
    }
  }

  // 3. Remaining fields — smart formatting
  for (const [key, val] of Object.entries(fields)) {
    if (SKIP_KEYS.has(key) || val === null || val === undefined) continue
    const formatted = formatFieldNatural(key, val)
    if (formatted) sentences.push(formatted)
  }

  // 4. Append objectId at the end for keyword matching
  sentences.push(objectId)

  return sentences.filter(Boolean).join('. ')
}

function formatFieldNatural(key: string, val: unknown): string {
  if (typeof val === 'boolean') {
    // human-readable boolean: "available" / "not available"
    const label = key.replace(/_/g, ' ')
    return val ? label.charAt(0).toUpperCase() + label.slice(1) : `Not ${label}`
  }

  if (typeof val === 'number') {
    const formatter = UNIT_PATTERNS[key]
    if (formatter) return formatter(val)
    // Infer from key suffix
    if (key.endsWith('_usd')) return `$${val} USD`
    if (key.endsWith('_eur')) return `${val}€`
    if (key.endsWith('_days')) return `${val} days`
    if (key.endsWith('_hours')) return `${val} hours`
    if (key.endsWith('_kg')) return `${val} kg`
    return `${key.replace(/_/g, ' ')}: ${val}`
  }

  if (Array.isArray(val)) {
    const items = val.filter(v => v !== null && v !== undefined).map(String)
    return items.length > 0 ? items.join(', ') : ''
  }

  if (typeof val === 'string' && val.trim()) {
    // For short values, include key for context; for long values, value speaks for itself
    if (val.length > 100) return val.trim()
    return `${key.replace(/_/g, ' ')}: ${val.trim()}`
  }

  return ''
}

// ─── processRecords ───────────────────────────────────────────

const EMBED_BATCH = 50

export async function processRecords(
  records: RecordInput[],
  supabase: SupabaseClient,
  openaiApiKey: string
): Promise<void> {
  if (records.length === 0) return

  // Build searchable texts
  const searchableTexts = records.map(r => buildSearchableText(r.objectId, r.fields))

  // Batch embed in groups of EMBED_BATCH, run batches in parallel
  const batches: string[][] = []
  for (let i = 0; i < searchableTexts.length; i += EMBED_BATCH) {
    batches.push(searchableTexts.slice(i, i + EMBED_BATCH))
  }

  const embeddingBatches = await Promise.all(
    batches.map(batch => embedTexts(batch, openaiApiKey))
  )
  const embeddings = embeddingBatches.flat()

  // Build upsert rows
  const rows = records.map((r, i) => ({
    merchant_id:     r.merchantId,
    index_name:      r.indexName,
    object_id:       r.objectId,
    fields:          r.fields,
    searchable_text: searchableTexts[i],
    embedding:       embeddings[i] as unknown as string,
    brand_id:        r.brandId ?? null,
    updated_at:      new Date().toISOString(),
  }))

  const { data: upserted, error } = await supabase
    .from('records')
    .upsert(rows, { onConflict: 'merchant_id,index_name,object_id' })
    .select('id, merchant_id')

  if (error) {
    consola.error({ tag: 'record-processor', message: 'Upsert failed', error: error.message })
    throw createError({ statusCode: 500, message: 'Failed to store records' })
  }

  if (upserted && upserted.length > 0) {
    const merchantId = (upserted[0]?.merchant_id ?? '') as string
    const recordIds  = upserted.map(r => r.id as string)
    await buildEdges(recordIds, merchantId, records, supabase)
  }
}

// ─── buildEdges ───────────────────────────────────────────────
//
// Builds top-K nearest-neighbor edges (K=5) instead of all-pairs to avoid
// O(n²) growth. For 50 products in "shoes", all-pairs creates 2,450 edges;
// top-K=5 creates at most 250 (50 × 5), keeping the edge table lean.
//
// Strategy: within each (edgeType, edgeValue) group, each record gets edges
// to at most K other records — prioritising those that appear earliest in the
// upserted batch (i.e. highest-ranked by the caller's ordering). Bidirectional
// edges are created so graph traversal works in both directions.

const TOP_K_NEIGHBORS = 5

export async function buildEdges(
  recordIds: string[],
  merchantId: string,
  records: RecordInput[],
  supabase: SupabaseClient
): Promise<void> {
  // Group record IDs by (edgeType, edgeValue)
  const groupMap = new Map<string, string[]>() // key = `${type}::${value}` → [recordId, ...]

  for (let i = 0; i < recordIds.length; i++) {
    const fields = records[i]?.fields ?? {}
    for (const edgeType of EDGE_FIELD_KEYS) {
      const val = fields[edgeType]
      if (typeof val === 'string' && val.trim()) {
        const key = `${edgeType}::${val.trim().toLowerCase()}`
        const group = groupMap.get(key) ?? []
        group.push(recordIds[i]!)
        groupMap.set(key, group)
      }
    }
  }

  const edges: Array<{
    merchant_id: string
    source_record_id: string
    target_record_id: string
    edge_type: string
    edge_value: string
  }> = []

  for (const [key, ids] of groupMap.entries()) {
    if (ids.length < 2) continue
    const [edgeType, edgeValue] = key.split('::') as [string, string]

    for (let srcIdx = 0; srcIdx < ids.length; srcIdx++) {
      const src = ids[srcIdx]!
      // Take up to TOP_K_NEIGHBORS targets, skipping self
      let neighborCount = 0
      for (let tgtIdx = 0; tgtIdx < ids.length && neighborCount < TOP_K_NEIGHBORS; tgtIdx++) {
        const tgt = ids[tgtIdx]!
        if (src === tgt) continue
        edges.push({ merchant_id: merchantId, source_record_id: src, target_record_id: tgt, edge_type: edgeType, edge_value: edgeValue })
        neighborCount++
      }
    }
  }

  if (edges.length === 0) return

  consola.debug({ tag: 'record-processor', message: `buildEdges: ${edges.length} edges (top-K=${TOP_K_NEIGHBORS})` })

  const { error } = await supabase
    .from('record_edges')
    .upsert(edges, { onConflict: 'source_record_id,target_record_id,edge_type' })

  if (error) {
    consola.warn({ tag: 'record-processor', message: 'buildEdges upsert error', error: error.message })
  }
}
