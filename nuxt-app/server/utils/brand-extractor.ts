import OpenAI from 'openai'
import { consola } from 'consola'

/**
 * Extract a concise brand description from brand-typed chunks.
 * Single GPT-4o-mini call summarizes all brand content into 2-3 sentences.
 */
export async function extractBrandDescription(
  brandChunks: Array<{ content: string }>
): Promise<string> {
  if (brandChunks.length === 0) return ''

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    consola.warn('[brand-extractor] OPENAI_API_KEY not set, skipping extraction')
    return ''
  }

  const openai = new OpenAI({ apiKey })

  // Limit total input to ~3000 chars to stay within reasonable token budget
  let totalChars = 0
  const selectedChunks: string[] = []
  for (const chunk of brandChunks) {
    if (totalChars + chunk.content.length > 3000) break
    selectedChunks.push(chunk.content)
    totalChars += chunk.content.length
  }

  const chunksText = selectedChunks
    .map((c, i) => `[${i + 1}] ${c}`)
    .join('\n\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Summarize the following brand/company information into a concise 2-3 sentence description that captures who the company is, what they do, and their key values. Return only the summary, no preamble.\n\n${chunksText}`,
        },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    return text.trim()
  } catch (err) {
    consola.error('[brand-extractor] Extraction failed:', err)
    return ''
  }
}
