import type Anthropic from '@anthropic-ai/sdk'

// ─── Shared types ───────────────────────────────────────────

interface ChunkResult {
  id: string
  content: string
  similarity: number
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

interface MerchantInfo {
  name: string
  domain: string | null
}

interface RecordResult {
  object_id: string
  index_name: string
  fields: Record<string, unknown>
  similarity: number
  neighbors?: Array<Record<string, unknown>>
}

function buildIndexedRecordsSection(records: RecordResult[]): string {
  if (records.length === 0) return ''
  const lines = records.map(r => {
    const main = JSON.stringify(r.fields, null, 2)
    const neighborSection = r.neighbors && r.neighbors.length > 0
      ? '\n  Related:\n' + r.neighbors.map(n => '  ' + JSON.stringify(n)).join('\n')
      : ''
    return `[${r.index_name}/${r.object_id}] (relevance: ${r.similarity.toFixed(2)})\n${main}${neighborSection}`
  })
  return '\nIndexed Records:\n' + lines.join('\n\n')
}

// ─── Original chunk-based prompt (backward compatible) ──────

export function buildPrompt(
  merchant: MerchantInfo,
  chunks: ChunkResult[],
  history: HistoryMessage[],
  userMessage: string,
  brandContext?: string | null,
  records?: RecordResult[]
): { system: string, messages: Anthropic.MessageParam[] } {
  let contextSection = ''
  if (chunks.length === 0 && (!records || records.length === 0)) {
    contextSection = '\nNo relevant context was found. Politely inform the user that you do not have enough information to answer their question.'
  } else if (chunks.length === 0) {
    contextSection = ''
  } else {
    contextSection = '\nContext:\n' + chunks.map((c, i) =>
      `[${i + 1}] (relevance: ${c.similarity.toFixed(2)})\n${c.content}`
    ).join('\n\n')
  }

  const recordsSection = buildIndexedRecordsSection(records ?? [])

  const system = `You are the AI assistant for ${merchant.name}${brandContext ? ', embodying the brand voice described below' : ''}. Answer questions using ONLY the context provided below.

STRICT RULES:
- Always respond in the same language as the user's message
- DO NOT infer, extrapolate, or create information not explicitly stated
- DO NOT combine partial information to create new facts
- Before each statement, verify it can be directly quoted from sources
- Always cite source URLs when available
- If specific information is unavailable, acknowledge it naturally in 1 sentence, then suggest 1–2 related products or topics if available — never list missing info as bullet points
- Keep responses concise and conversational — avoid academic or disclaimer-heavy phrasing

Merchant: ${merchant.name}
Website: ${merchant.domain ?? 'not specified'}
${brandContext ? `\n[BRAND VOICE & IDENTITY]\nAdopt the following brand identity in your tone, vocabulary, and personality throughout every response:\n${brandContext}\n` : ''}${contextSection}${recordsSection}`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]

  return { system, messages }
}

// ─── Fact-based prompt (anti-hallucination pipeline) ────────

export function buildFactBasedPrompt(
  merchant: MerchantInfo,
  facts: Array<{ text: string, source: string | null }>,
  products: Array<{ name: string, price: number | null, currency: string, source_url: string }>,
  history: HistoryMessage[],
  userMessage: string,
  brandContext?: string | null,
  records?: RecordResult[]
): { system: string, messages: Anthropic.MessageParam[] } {
  // Format products as structured blocks
  let productsSection = ''
  if (products.length > 0) {
    productsSection = '\nProducts:\n' + products.map((p) => {
      const priceStr = p.price !== null ? `${p.price} ${p.currency}` : 'not listed'
      return `[Product: ${p.name} | Price: ${priceStr} | Source: ${p.source_url}]`
    }).join('\n')
  }

  // Format facts as numbered list with sources
  let factsSection = ''
  if (facts.length > 0) {
    factsSection = '\nVerified Facts:\n' + facts.map((f, i) => {
      const sourceStr = f.source ? ` (source: ${f.source})` : ''
      return `${i + 1}. ${f.text}${sourceStr}`
    }).join('\n')
  }

  const recordsSection = buildIndexedRecordsSection(records ?? [])

  const system = `You are the AI assistant for ${merchant.name}${brandContext ? ', embodying the brand voice described below' : ''}. Answer using ONLY the verified facts and product data below.

STRICT RULES:
- Always respond in the same language as the user's message
- DO NOT add any external knowledge, inference, or assumptions
- DO NOT combine facts to create new information not explicitly stated
- For each product you mention, briefly explain WHY it matches the user's request
- Always cite source URLs when referencing products or information
- If specific information is unavailable, acknowledge it naturally in 1 sentence, then suggest 1–2 related products or topics if available — never list missing info as bullet points
- Keep responses concise and conversational — avoid academic or disclaimer-heavy phrasing

Merchant: ${merchant.name}
Website: ${merchant.domain ?? 'not specified'}
${brandContext ? `\n[BRAND VOICE & IDENTITY]\nAdopt the following brand identity in your tone, vocabulary, and personality throughout every response:\n${brandContext}\n` : ''}${productsSection}
${factsSection}${recordsSection}`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]

  return { system, messages }
}

// ─── Aggregation prompt (full-catalog queries) ───────────────
//
// Called when queryIntent === 'aggregation'. Provides the COMPLETE record set
// to Claude and instructs it to count/group/rank rather than retrieve.

interface AggregationRecord {
  object_id: string
  fields: Record<string, unknown>
  searchable_text: string
}

export function buildAggregationPrompt(
  merchant: MerchantInfo,
  records: AggregationRecord[],
  history: HistoryMessage[],
  userMessage: string,
  brandContext?: string | null
): { system: string, messages: Anthropic.MessageParam[] } {
  const totalCount = records.length
  const MAX_SHOWN = 150

  // One compact JSON object per line — most token-efficient format for large record sets
  const catalogLines = records.map(r => JSON.stringify(r.fields)).join('\n')

  const partialNote = totalCount >= MAX_SHOWN
    ? `\nNote: showing up to ${MAX_SHOWN} records. If the catalog has more, your count reflects only these ${MAX_SHOWN} items.`
    : ''

  const system = `You are the AI assistant for ${merchant.name}${brandContext ? ', embodying the brand voice described below' : ''}.

You have been provided with the COMPLETE catalog for this merchant (${totalCount} total records).${partialNote}

Your task is to perform the aggregation, count, grouping, or ranking that the user requests.

RULES:
- Always respond in the same language as the user's message
- Count EVERY record provided — do not sample or approximate
- Group by the exact field value present in the data
- If the requested field does not exist in any record, say so explicitly
- Do NOT infer data that is not present
- Present results in a clear format (markdown table or bulleted list as appropriate)
- Keep the response concise

Merchant: ${merchant.name}
Website: ${merchant.domain ?? 'not specified'}
${brandContext ? `\n[BRAND VOICE & IDENTITY]\nAdopt the following brand identity in your tone, vocabulary, and personality throughout every response:\n${brandContext}\n` : ''}
Catalog (${totalCount} records, one JSON object per line):
${catalogLines}`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]

  return { system, messages }
}
