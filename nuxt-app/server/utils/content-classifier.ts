import OpenAI from 'openai'
import { consola } from 'consola'

export type ContentType = 'brand' | 'product' | 'faq' | 'support' | 'other'

// ─── Structural heuristics (free, no API call) ──────────────

const QA_PATTERN = /^(?:\s*(?:Q[:.]|#{1,3}\s*Q[:.]|\?)\s)/m

/**
 * Detect FAQ-like pages by checking for Q&A formatting patterns in markdown.
 * Returns true if 3+ lines match Q&A structure.
 */
function looksLikeFaq(markdown: string): boolean {
  const lines = markdown.split('\n')
  let qaCount = 0
  for (const line of lines) {
    if (QA_PATTERN.test(line)) {
      qaCount++
      if (qaCount >= 3) return true
    }
  }
  return false
}

/**
 * Apply free structural heuristics to classify a page.
 * Returns null if no heuristic matches (needs LLM).
 */
function classifyByHeuristics(page: { markdown: string, hasProducts: boolean }): ContentType | null {
  if (page.hasProducts) return 'product'
  if (looksLikeFaq(page.markdown)) return 'faq'
  return null
}

// ─── Batch GPT-4o-mini classification ───────────────────────

const BATCH_SIZE = 15

const PAGE_CLASSIFICATION_PROMPT = `You are a content classifier for ecommerce websites. For each page, classify it as exactly one of: brand, product, faq, support, other.

Definitions:
- brand: Company information, mission, values, team, history, about us
- product: Product or service descriptions, features, pricing, specifications, offerings with prices or booking
- faq: Frequently asked questions, Q&A format content
- support: Return policies, shipping info, warranties, contact info, terms, privacy
- other: Navigation, generic content, or content that doesn't fit above categories

Return a JSON object with a "labels" key containing an array of labels, one per page, in the same order.
Example: {"labels": ["brand", "product", "other"]}

Pages to classify:`

interface PageInput {
  url: string
  title: string
  markdown: string
  hasProducts: boolean
}

/**
 * Classify pages in batch using structural heuristics first, then GPT-4o-mini
 * for ambiguous pages. All chunks from a page inherit the page-level type.
 *
 * Returns one ContentType per page, in the same order as the input.
 */
export async function classifyPages(pages: PageInput[]): Promise<ContentType[]> {
  if (pages.length === 0) return []

  const results: (ContentType | null)[] = pages.map(p => classifyByHeuristics(p))

  // Collect indices that need LLM classification
  const ambiguousIndices: number[] = []
  for (let i = 0; i < results.length; i++) {
    if (results[i] === null) ambiguousIndices.push(i)
  }

  if (ambiguousIndices.length === 0) {
    return results as ContentType[]
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    consola.warn('[content-classifier] OPENAI_API_KEY not set, defaulting ambiguous pages to "other"')
    for (const idx of ambiguousIndices) results[idx] = 'other'
    return results as ContentType[]
  }

  const openai = new OpenAI({ apiKey })
  const validTypes = new Set<string>(['brand', 'product', 'faq', 'support', 'other'])

  // Process ambiguous pages in batches
  for (let batchStart = 0; batchStart < ambiguousIndices.length; batchStart += BATCH_SIZE) {
    const batchIndices = ambiguousIndices.slice(batchStart, batchStart + BATCH_SIZE)
    const batchPages = batchIndices.map(idx => pages[idx]!)

    const pagesText = batchPages
      .map((p, i) => `[Page ${i + 1}]\nTitle: ${p.title}\nURL: ${p.url}\n${p.markdown.slice(0, 300)}`)
      .join('\n\n')

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: Math.max(256, batchPages.length * 20),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a content classifier. Always respond with valid JSON.' },
          { role: 'user', content: `${PAGE_CLASSIFICATION_PROMPT}\n\n${pagesText}` }
        ]
      })

      const text = response.choices[0]?.message?.content ?? ''
      let labels: string[]

      try {
        const parsed = JSON.parse(text)
        labels = Array.isArray(parsed) ? parsed : (parsed.labels ?? [])
      } catch {
        const match = text.match(/\[[\s\S]*\]/)
        if (!match) {
          consola.warn('[content-classifier] Failed to parse batch response, defaulting to "other"', { text: text.slice(0, 200) })
          for (const idx of batchIndices) results[idx] = 'other'
          continue
        }
        labels = JSON.parse(match[0])
      }

      for (let i = 0; i < batchIndices.length; i++) {
        const label = labels[i]?.toLowerCase()
        const idx = batchIndices[i]!
        results[idx] = validTypes.has(label ?? '') ? (label as ContentType) : 'other'
      }
    } catch (err) {
      consola.error('[content-classifier] Batch classification failed:', err)
      for (const idx of batchIndices) results[idx] = 'other'
    }
  }

  return results as ContentType[]
}
