import OpenAI from 'openai'
import { consola } from 'consola'

export type QueryIntent = 'product' | 'brand' | 'support' | 'general' | 'aggregation'

const VALID_INTENTS = new Set<string>(['product', 'brand', 'support', 'general', 'aggregation'])

// ─── Singleton OpenAI client (R11) ───────────────────────────
const clientCache = new Map<string, OpenAI>()
function getOpenAIClient(apiKey: string): OpenAI {
  let c = clientCache.get(apiKey)
  if (!c) { c = new OpenAI({ apiKey }); clientCache.set(apiKey, c) }
  return c
}

// ─── R9a: Rule-based fast-path ───────────────────────────────
// Handles ~60-70% of typical ecommerce queries without an LLM call.
// Returns null when no rule matches (fall through to GPT-4o-mini).
function classifyByRules(query: string): QueryIntent | null {
  const q = query.toLowerCase()

  // Aggregation patterns — must come BEFORE product rules to avoid misclassification
  // of queries like "most popular" (could match product rules) or "how many" queries
  if (
    /\b(how many|count|combien|nombre de|total number|total count)\b/.test(q) ||
    /\b(list all|all destinations|all products|all items|toutes les|liste de tous|quels sont tous)\b/.test(q) ||
    /\b(most popular|most expensive|least expensive|highest|lowest|le plus|la plus|best selling|top selling)\b/.test(q) ||
    /\b(breakdown by|group by|répartition|per destination|per category|by category|by destination)\b/.test(q)
  ) {
    return 'aggregation'
  }

  // Support/policy patterns
  if (/\b(return|refund|exchange|ship|delivery|track|order|cancel|policy|warranty|guarantee)\b/.test(q)) {
    return 'support'
  }
  // Brand patterns
  if (/\b(brand|maker|manufacturer|who makes|made by|collection|line)\b/.test(q)) {
    return 'brand'
  }
  // Product patterns — price, spec, feature queries
  if (/\b(price|cost|how much|size|color|colour|material|weight|dimension|available|stock|buy|purchase|spec|feature)\b/.test(q)) {
    return 'product'
  }

  return null // Fall through to LLM
}

/**
 * Classify user query intent.
 * First tries a fast rule-based path (R9a); falls back to GPT-4o-mini for
 * ambiguous queries. Language-agnostic — works for any ecommerce site.
 */
export async function classifyIntent(
  query: string,
  openaiApiKey?: string,
  merchantName?: string
): Promise<QueryIntent> {
  // R9a: attempt rule-based classification first (no LLM call)
  const ruleIntent = classifyByRules(query)
  if (ruleIntent !== null) {
    consola.debug({ tag: 'query-router', intent: ruleIntent, source: 'rules' })
    return ruleIntent
  }

  if (!openaiApiKey) {
    consola.warn('[query-router] No API key, defaulting to "general"')
    return 'general'
  }

  try {
    const openai = getOpenAIClient(openaiApiKey)
    const merchantLine = merchantName ? `\nMerchant: ${merchantName}` : ''

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 16,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Classify this ecommerce chat query into exactly one: product, brand, support, general, aggregation.
- product: looking for specific items, prices, availability, comparisons, recommendations — in ANY language
- brand: asking about the company, mission, values, team, history
- support: shipping, returns, policies, contact, order tracking
- aggregation: counting items, listing ALL items in a category, superlatives (most/least popular, highest/lowest), breakdowns or distributions across the full catalog
- general: greetings, unclear, or mixed intent
The query may be in any language. Classify based on meaning, not language.
${merchantLine}
Query: ${query}

Respond with only the label.`
      }]
    })

    const text = (response.choices[0]?.message?.content ?? 'general').trim().toLowerCase()
    const intent = VALID_INTENTS.has(text) ? (text as QueryIntent) : 'general'
    consola.debug({ tag: 'query-router', intent, source: 'llm' })
    return intent
  } catch (err) {
    consola.error('[query-router] Classification failed:', err)
    return 'general'
  }
}
