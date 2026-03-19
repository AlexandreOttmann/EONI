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

// ─── Original chunk-based prompt (backward compatible) ──────

export function buildPrompt(
  merchant: MerchantInfo,
  chunks: ChunkResult[],
  history: HistoryMessage[],
  userMessage: string
): { system: string, messages: Anthropic.MessageParam[] } {
  let contextSection = ''
  if (chunks.length === 0) {
    contextSection = '\nNo relevant context was found. Politely inform the user that you do not have enough information to answer their question.'
  } else {
    contextSection = '\nContext:\n' + chunks.map((c, i) =>
      `[${i + 1}] (relevance: ${c.similarity.toFixed(2)})\n${c.content}`
    ).join('\n\n')
  }

  const system = `You are a helpful assistant for ${merchant.name}. Answer questions using ONLY the context provided below.

STRICT RULES:
- DO NOT infer, extrapolate, or create information not explicitly stated
- DO NOT combine partial information to create new facts
- Before each statement, verify it can be directly quoted from sources
- If context is incomplete, clearly state what's missing
- Always cite source URLs when available

When information is unavailable, say: "This specific information is not provided in the available sources."

Merchant: ${merchant.name}
Website: ${merchant.domain ?? 'not specified'}
${contextSection}`

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
  userMessage: string
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

  const system = `You are a helpful assistant for ${merchant.name}. Answer using ONLY the verified facts and product data below.

STRICT RULES:
- DO NOT add any external knowledge, inference, or assumptions
- DO NOT combine facts to create new information not explicitly stated
- For each product you mention, briefly explain WHY it matches the user's request
- If facts are incomplete, explicitly state what information is missing
- Always cite source URLs when referencing products or information
- Keep your response focused and concise

Merchant: ${merchant.name}
Website: ${merchant.domain ?? 'not specified'}
${productsSection}
${factsSection}`

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]

  return { system, messages }
}
