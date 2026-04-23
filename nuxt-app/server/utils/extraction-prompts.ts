/**
 * Extraction prompts + per-page dispatcher.
 *
 * Product extraction happens at crawl time via Cloudflare's browser-rendering
 * API (using PRODUCT_EXTRACTION_PROMPT + PRODUCT_EXTRACTION_SCHEMA below), so
 * products arrive pre-extracted in `page.items`. For FAQ and support pages we
 * make a separate GPT-4o-mini call at record-building time because the CF
 * crawl only runs the product prompt.
 */

import type OpenAI from 'openai'
import { consola } from 'consola'
import { z } from 'zod'
import type { ContentType } from './content-classifier'

// ─── Product extraction (used by Cloudflare browser-rendering) ──

export const PRODUCT_EXTRACTION_PROMPT = `Analyze this page and extract:
1. A natural language summary (2-3 sentences) describing the page content, suitable for semantic search.
2. All products, services, or offerings found and listed on the page.
If the page lists multiple products (e.g. category, search results),
extract EACH listing as a separate item.
For each item: extract name, description, price (number without currency symbol),
currency (ISO 4217: USD, EUR, GBP), availability (in_stock, out_of_stock, preorder),
SKU or product code if present, category or type, and primary image URL.
If this page does not contain product or service listings, return an empty items array.
Focus on the main content — ignore navigation, footer, sidebar, cookie banners.`

export const PRODUCT_EXTRACTION_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'page_extraction',
    properties: {
      page_summary: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            availability: { type: 'string' },
            sku: { type: 'string' },
            category: { type: 'string' },
            image_url: { type: 'string' }
          }
        }
      }
    }
  }
}

// Back-compat aliases — existing imports still use the legacy names.
export const EXTRACTION_PROMPT = PRODUCT_EXTRACTION_PROMPT
export const EXTRACTION_SCHEMA = PRODUCT_EXTRACTION_SCHEMA

// ─── FAQ + support extraction prompts ────────────────────────────

export const FAQ_EXTRACTION_PROMPT = `You are an FAQ extractor. Given a page's title and markdown, extract every distinct Q&A pair. Return a JSON object {"items": [{"question": "...", "answer": "...", "topic": "optional short category"}, ...]}. If no Q&A structure exists, return {"items": []}. The question must be a question; the answer must be the complete answer as written. Do not invent pairs.`

export const SUPPORT_EXTRACTION_PROMPT = `You are a support content extractor. Given a page's title and markdown, extract the single most important policy or support topic. Return {"items": [{"topic": "...", "body": "...", "policy_type": "shipping|returns|warranty|privacy|terms|contact|other"}]}. Return {"items": []} only if the page has no support/policy content at all. \`body\` should be the complete policy text as written. \`policy_type\` must be one of the enum values exactly.`

// ─── Zod schemas ─────────────────────────────────────────────────

const FaqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  topic: z.string().optional()
})

const SupportItemSchema = z.object({
  topic: z.string().min(1),
  body: z.string().min(1),
  policy_type: z.enum([
    'shipping',
    'returns',
    'warranty',
    'privacy',
    'terms',
    'contact',
    'other'
  ])
})

const FaqResponseSchema = z.object({ items: z.array(FaqItemSchema) })
const SupportResponseSchema = z.object({ items: z.array(SupportItemSchema) })

export type FaqItem = z.infer<typeof FaqItemSchema>
export type SupportItem = z.infer<typeof SupportItemSchema>

// Product items come from Cloudflare extraction and are shaped upstream.
export type ProductItem = Record<string, unknown>

export type ExtractedItem
  = | ({ __kind: 'product' } & ProductItem)
    | ({ __kind: 'faq' } & FaqItem)
    | ({ __kind: 'support' } & SupportItem)

// ─── Dispatcher ──────────────────────────────────────────────────

interface ExtractionPage {
  url: string
  title: string
  markdown: string
  items?: unknown[]
  pageSummary?: string | null
}

const MIN_MARKDOWN_LENGTH = 200

/**
 * Route a page to the correct extraction path based on its classified type.
 *
 * - `product`: pass-through — Cloudflare already extracted items at crawl time.
 * - `faq`: GPT-4o-mini call with FAQ_EXTRACTION_PROMPT.
 * - `support`: GPT-4o-mini call with SUPPORT_EXTRACTION_PROMPT.
 * - `brand` / `other`: no records.
 *
 * Never throws. LLM/parse failures log and return [].
 */
export async function extractRecordsForPage(
  page: ExtractionPage,
  pageType: ContentType,
  openai: OpenAI
): Promise<ExtractedItem[]> {
  if (pageType === 'product') {
    const items = (page.items ?? []).filter(
      (it): it is Record<string, unknown> =>
        typeof it === 'object' && it !== null && !Array.isArray(it)
    )
    return items.map(it => ({ __kind: 'product' as const, ...it }))
  }

  if (pageType === 'brand' || pageType === 'other') {
    return []
  }

  if ((page.markdown?.length ?? 0) < MIN_MARKDOWN_LENGTH) {
    return []
  }

  if (pageType === 'faq') {
    return extractFaq(page, openai)
  }

  if (pageType === 'support') {
    return extractSupport(page, openai)
  }

  return []
}

async function extractFaq(
  page: ExtractionPage,
  openai: OpenAI
): Promise<ExtractedItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: FAQ_EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Title: ${page.title}\nURL: ${page.url}\n\n${page.markdown}`
        }
      ]
    })

    const text = response.choices[0]?.message?.content ?? ''
    const parsed = FaqResponseSchema.safeParse(JSON.parse(text))
    if (!parsed.success) {
      consola.warn({
        tag: 'extraction-prompts',
        message: 'FAQ parse failed',
        error: parsed.error.message,
        url: page.url
      })
      return []
    }
    return parsed.data.items.map(it => ({ __kind: 'faq' as const, ...it }))
  } catch (err) {
    consola.warn({
      tag: 'extraction-prompts',
      message: 'FAQ extraction failed',
      error: err instanceof Error ? err.message : String(err),
      url: page.url
    })
    return []
  }
}

async function extractSupport(
  page: ExtractionPage,
  openai: OpenAI
): Promise<ExtractedItem[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SUPPORT_EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Title: ${page.title}\nURL: ${page.url}\n\n${page.markdown}`
        }
      ]
    })

    const text = response.choices[0]?.message?.content ?? ''
    const parsed = SupportResponseSchema.safeParse(JSON.parse(text))
    if (!parsed.success) {
      consola.warn({
        tag: 'extraction-prompts',
        message: 'Support parse failed',
        error: parsed.error.message,
        url: page.url
      })
      return []
    }
    return parsed.data.items.map(it => ({ __kind: 'support' as const, ...it }))
  } catch (err) {
    consola.warn({
      tag: 'extraction-prompts',
      message: 'Support extraction failed',
      error: err instanceof Error ? err.message : String(err),
      url: page.url
    })
    return []
  }
}
