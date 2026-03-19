import type Anthropic from '@anthropic-ai/sdk'

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
