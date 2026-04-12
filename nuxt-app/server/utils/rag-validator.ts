import OpenAI from 'openai'
import { z } from 'zod'

// ─── Singleton OpenAI client (R11) ───────────────────────────
const clientCache = new Map<string, OpenAI>()
function getOpenAIClient(apiKey: string): OpenAI {
  let c = clientCache.get(apiKey)
  if (!c) { c = new OpenAI({ apiKey }); clientCache.set(apiKey, c) }
  return c
}

// ─── Validation schema ──────────────────────────────────────

const validationSchema = z.object({
  answerable: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  facts: z.array(z.object({
    text: z.string(),
    source: z.string().nullable()
  })),
  missing: z.array(z.string())
})

export type ValidationResult = z.infer<typeof validationSchema> & {
  suggestedProducts?: Array<{ name: string, source: string }>
}

// ─── Context formatting ─────────────────────────────────────

function formatProductsContext(
  products: Array<{ name: string, description: string | null, price: number | null, currency: string, source_url: string, similarity: number }>
): string {
  if (products.length === 0) return ''
  return products.map((p, i) => {
    const parts = [`[Product ${i + 1}] ${p.name}`]
    if (p.price !== null) parts.push(`Price: ${p.price} ${p.currency}`)
    parts.push(`URL: ${p.source_url}`)
    if (p.description) parts.push(`Description: ${p.description}`)
    return parts.join(' | ')
  }).join('\n')
}

function formatChunksContext(
  chunks: Array<{ content: string, similarity: number }>
): string {
  if (chunks.length === 0) return ''
  return chunks.map((c, i) =>
    `[Content ${i + 1}] (similarity: ${c.similarity.toFixed(2)})\n${c.content}`
  ).join('\n\n')
}

function formatRecordsContext(
  records: Array<{ object_id: string, index_name: string, fields: Record<string, unknown>, similarity: number }>
): string {
  if (records.length === 0) return ''
  return records.map((r, i) => {
    const fields = Object.entries(r.fields)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' | ')
    return `[Record ${i + 1}] ${r.index_name}/${r.object_id} (similarity: ${r.similarity.toFixed(2)})\n${fields}`
  }).join('\n\n')
}

// ─── Validation system prompt ───────────────────────────────

const VALIDATION_SYSTEM_PROMPT = `You are a strict fact-checker for an ecommerce assistant. Given a user question and context (products and/or content snippets), you must:

1. Determine if the question can be answered using ONLY the provided context (answerable: true/false)
2. Extract ONLY facts that are explicitly stated in the context — do NOT infer, combine, or extrapolate
3. For each fact, include the source URL if available
4. List what information would be needed to fully answer the question but is missing from the context

Rules:
- If the context contains direct, explicit answers to the question, set answerable: true
- If the context only partially addresses the question, set answerable: true with confidence: "medium" and list missing info
- If the context does not address the question at all, set answerable: false
- Never mark as answerable if doing so would require inference or external knowledge

Return ONLY valid JSON matching this schema:
{
  "answerable": boolean,
  "confidence": "high" | "medium" | "low",
  "facts": [{ "text": "explicit fact from context", "source": "source URL or null" }],
  "missing": ["description of missing information"]
}`

// ─── Main validation function ───────────────────────────────

export async function validateAndExtract(
  openaiApiKey: string,
  question: string,
  products: Array<{ name: string, description: string | null, price: number | null, currency: string, source_url: string, similarity: number }>,
  chunks: Array<{ content: string, similarity: number }>,
  records: Array<{ object_id: string, index_name: string, fields: Record<string, unknown>, similarity: number }> = []
): Promise<ValidationResult> {
  // Short-circuit: no context at all — skip LLM call
  if (products.length === 0 && chunks.length === 0 && records.length === 0) {
    return {
      answerable: false,
      confidence: 'low',
      facts: [],
      missing: ['No context found']
    }
  }

  // Build context for the validator
  const productsCtx = formatProductsContext(products)
  const chunksCtx = formatChunksContext(chunks)
  const recordsCtx = formatRecordsContext(records)

  let contextBlock = ''
  if (productsCtx) contextBlock += `Products:\n${productsCtx}\n\n`
  if (chunksCtx) contextBlock += `Content:\n${chunksCtx}\n\n`
  if (recordsCtx) contextBlock += `Indexed Records:\n${recordsCtx}\n\n`

  const userPrompt = `Question: ${question}\n\nContext:\n${contextBlock}Analyze the context and return your JSON assessment.`

  const openai = getOpenAIClient(openaiApiKey)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  })

  // Extract text from response
  const text = response.choices[0]?.message?.content ?? ''

  // Parse JSON from response — handle potential markdown code blocks
  let jsonText = text.trim()
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1]!.trim()
  }

  let parsed: z.infer<typeof validationSchema>
  try {
    parsed = validationSchema.parse(JSON.parse(jsonText))
  } catch {
    // If response is malformed JSON, default to conservative assessment
    return {
      answerable: false,
      confidence: 'low',
      facts: [],
      missing: ['Validation failed to parse — treating as unanswerable']
    }
  }

  // When not answerable but products exist, populate suggestedProducts for soft fallback
  const result: ValidationResult = { ...parsed }
  if (!parsed.answerable && products.length > 0) {
    result.suggestedProducts = products.map(p => ({
      name: p.name,
      source: p.source_url
    }))
  }

  return result
}
