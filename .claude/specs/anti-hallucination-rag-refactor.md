# Spec: Anti-Hallucination RAG Pipeline Refactor

**Phase:** 1
**Priority:** P0 (blocker — hallucinations undermine core product value)
**Branch:** `feat/anti-hallucination-rag`

---

## User Story

As a merchant, I want my chat widget to provide accurate, source-backed answers so that my customers trust the information and I don't lose sales to hallucinated responses.

---

## Problem

1. **Bad data in** — Chunks are raw HTML→plaintext, unstructured. Model guesses relationships between products, prices, attributes.
2. **Bad answering** — Single-step prompt (chunks → Claude → answer) with no validation. Model fills gaps in incomplete context.
3. **Low threshold** — 0.50 similarity lets irrelevant chunks through.

---

## Solution Overview

```
User query
   ↓
Retrieve products (primary, top 3, threshold 0.65)
   ↓
Fallback to chunks (only if no products found, top 5)
   ↓
Validate + extract facts (Haiku, ~300ms)
   ↓
IF not answerable:
   → soft fallback ("I don't have this exact info, but here are relevant options:")
   → show suggestedProducts
   → No Sonnet call (faster + cheaper)
ELSE:
   ↓
Fact-based prompt → Sonnet stream
   ↓
Answer with "why this matches" reasoning
```

---

## Part A: Structured Data Extraction at Crawl Time

### A1. Database — `products` table

**New migration:** `nuxt-app/supabase/migrations/0008_products_table.sql`

```sql
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  page_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  crawl_job_id uuid NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,

  name text NOT NULL,
  description text,
  price numeric,
  currency text DEFAULT 'EUR',
  availability text CHECK (availability IN ('in_stock','out_of_stock','preorder','unknown')),
  sku text,
  category text,
  image_url text,
  source_url text NOT NULL,
  extra_data jsonb DEFAULT '{}',

  -- Extraction quality tracking
  extraction_confidence text DEFAULT 'medium' CHECK (extraction_confidence IN ('high','medium','low')),
  missing_fields text[] DEFAULT '{}',

  -- Product-level embedding for RAG retrieval
  embedding vector(1536),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_crawl_job ON products(crawl_job_id);
CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS: merchants see own products via authenticated role
CREATE POLICY "Merchants see own products"
  ON products FOR SELECT
  USING (merchant_id = auth.uid());

-- Service role handles inserts/deletes (crawl worker)
CREATE POLICY "Service role inserts products"
  ON products FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role deletes products"
  ON products FOR DELETE USING (true);

-- Add counter to crawl_jobs
ALTER TABLE crawl_jobs ADD COLUMN products_extracted integer DEFAULT 0;
```

### A2. Database — `match_products` RPC

**New migration:** `nuxt-app/supabase/migrations/0009_match_products_function.sql`

Same pattern as existing `match_chunks` (see `0003_match_chunks_function.sql`):

```sql
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_merchant_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  currency text,
  availability text,
  category text,
  source_url text,
  image_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.availability,
    p.category,
    p.source_url,
    p.image_url,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.merchant_id = p_merchant_id
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Restrict to service_role only
REVOKE ALL ON FUNCTION match_products FROM anon, authenticated;
```

### A3. CF `jsonOptions` extraction prompt

**New file:** `nuxt-app/server/utils/extraction-prompts.ts`

```ts
export const EXTRACTION_PROMPT = `Extract product or service information from this page.
For each item found, extract: name, description, price (number without currency symbol),
currency (ISO 4217: USD, EUR, GBP), availability (in_stock, out_of_stock, preorder),
SKU or product code if present, category or type, and primary image URL.
If this page does not contain product or service listings, return an empty items array.
Focus on the main content — ignore navigation, footer, sidebar, cookie banners.`

export const EXTRACTION_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "page_extraction",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            currency: { type: "string" },
            availability: { type: "string" },
            sku: { type: "string" },
            category: { type: "string" },
            image_url: { type: "string" }
          }
        }
      }
    }
  }
}
```

### A4. Crawl worker — process structured JSON + markdown

**Modify:** `nuxt-app/server/utils/crawl-worker.ts`

Changes:
1. Update `CfRecord` type:
   ```ts
   type CfRecord = {
     url: string
     status: string
     markdown?: string
     json?: { items?: Array<Record<string, unknown>> }
     metadata: { title?: string, status?: number, [key: string]: unknown }
   }
   ```

2. Switch from HTML to markdown — use `record.markdown` directly, remove `htmlToText()` function

3. After chunk processing, process products from `record.json.items[]`:
   - **Post-validate** each item: skip if `!item.name`, track `missing_fields` and `extraction_confidence`
   - Serialize each product for embedding using structured format:
     ```
     Product: Japan Cultural Journey
     Description: 12-day cultural trip in Japan
     Price: 3800 EUR
     Availability: in_stock
     Category: Travel
     Source: https://example.com/japan
     ```
   - Generate embeddings via `embedTexts()` (same as chunks)
   - Insert into `products` table with `merchant_id`, `page_id`, `crawl_job_id`, `extraction_confidence`, `missing_fields`
   - Update `products_extracted` counter on `crawl_jobs`

### A5. Crawl start — add jsonOptions

**Modify:** `nuxt-app/server/api/crawl/start.post.ts`

Change CF request body from `{ url }` to:
```ts
body: {
  url,
  formats: ["markdown", "json"],
  rejectResourceTypes: ["image", "media", "font", "stylesheet"],
  jsonOptions: {
    prompt: EXTRACTION_PROMPT,
    response_format: EXTRACTION_SCHEMA
  }
}
```

Import `EXTRACTION_PROMPT` and `EXTRACTION_SCHEMA` from `extraction-prompts.ts`.

---

## Part B: 2-Step Validation Pipeline at Query Time

### B1. Products-first retrieval

**Modify:** `nuxt-app/server/utils/chat.ts`

Replace current single `match_chunks` call with products-first strategy:

```ts
// 1. Search products first (top 3, threshold 0.65)
const { data: productResults } = await supabase.rpc('match_products', {
  query_embedding: queryEmbedding as unknown as string,
  match_threshold: 0.65,
  match_count: 3,
  p_merchant_id: merchantId
})
const products = productResults ?? []

// 2. Fallback to chunks ONLY if no products found
let chunks: Array<{ id: string, content: string, similarity: number }> = []
if (products.length === 0) {
  const { data: chunkResults } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding as unknown as string,
    match_threshold: 0.65,
    match_count: 5,
    p_merchant_id: merchantId
  })
  chunks = chunkResults ?? []
}
```

Update `buildChatContext()` return type to include `products`.

### B2. Validation + fact extraction gate

**New file:** `nuxt-app/server/utils/rag-validator.ts`

```ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

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

export async function validateAndExtract(
  anthropicApiKey: string,
  question: string,
  products: Array<{ name: string, description: string | null, price: number | null, currency: string, source_url: string, similarity: number }>,
  chunks: Array<{ content: string, similarity: number }>
): Promise<ValidationResult>
```

Implementation:
- **Short-circuit:** If both products and chunks are empty → return `{ answerable: false, confidence: 'low', facts: [], missing: ['No context found'] }` without LLM call
- Uses **Claude Haiku** (`claude-haiku-4-5-20251001`, non-streaming, `max_tokens: 512`)
- System prompt:
  ```
  You are a strict fact-checker. Given a user question and context (products + content),
  determine:
  1. Can the question be answered from this context? (answerable: true/false)
  2. Extract ONLY facts explicitly stated in the context (no inference)
  3. List what information is missing to fully answer

  Return JSON: { answerable, confidence, facts: [{text, source}], missing: [] }
  ```
- Zod-parse the response
- When `answerable: false` but products exist, populate `suggestedProducts` with top product names+URLs for soft fallback

### B3. Fact-based prompt builder

**Modify:** `nuxt-app/server/utils/prompt.ts`

Add new function `buildFactBasedPrompt()`:

```ts
export function buildFactBasedPrompt(
  merchant: MerchantInfo,
  facts: Array<{ text: string, source: string | null }>,
  products: Array<{ name: string, price: number | null, currency: string, source_url: string }>,
  history: HistoryMessage[],
  userMessage: string
): { system: string, messages: Anthropic.MessageParam[] }
```

- Products formatted as structured blocks:
  ```
  [Product: Japan Cultural Journey | Price: 3800 EUR | Source: example.com/japan]
  ```
- Facts as numbered list with sources
- System prompt includes:
  - "Answer using ONLY the verified facts and product data below"
  - "DO NOT add any external knowledge"
  - "For each product you mention, briefly explain WHY it matches the user's request"
  - "If facts are incomplete, explicitly state what is missing"
  - "Always cite source URLs"

Keep existing `buildPrompt()` unchanged (used by chunks fallback path).

### B4. Wire 2-step pipeline into stream endpoint

**Modify:** `nuxt-app/server/api/chat/stream.post.ts`

New flow inside the async IIFE:

```ts
const startTime = Date.now()

// 1. Get context (products-first, chunks-fallback)
const { conversationId, products, chunks, ... } = await buildChatContext(...)

// 2. Validate + extract facts (Haiku, ~300ms)
const validation = await validateAndExtract(
  config.anthropicApiKey, body.message, products, chunks
)

// 3. Log query (observability)
consola.info({
  tag: 'rag-query',
  query: body.message,
  merchant_id: merchantId,
  products_retrieved: products.length,
  chunks_retrieved: chunks.length,
  answerable: validation.answerable,
  confidence: validation.confidence,
  missing: validation.missing,
  latency_ms: Date.now() - startTime
})

// 4. Handle response
if (!validation.answerable) {
  // Soft fallback — no Sonnet call
  await stream.push({ event: 'sources', data: JSON.stringify({ chunks: [], products }) })

  let fallback = "I don't have enough information from the available sources to answer that question."
  if (validation.suggestedProducts?.length) {
    fallback += "\n\nHowever, here are some options that might be relevant:\n"
    fallback += validation.suggestedProducts
      .map(p => `- **${p.name}** — [View details](${p.source})`)
      .join('\n')
  }
  await stream.push({ event: 'chunk', data: JSON.stringify({ text: fallback }) })
  // Persist + done...
} else {
  // Fact-based answer via Sonnet
  const { system, messages } = buildFactBasedPrompt(
    merchantInfo, validation.facts, products, history, body.message
  )
  await stream.push({ event: 'sources', data: JSON.stringify({ chunks, products }) })
  // Stream from Sonnet as before...
}
```

SSE contract unchanged: `sources`, `chunk`, `done`. Frontend needs no changes.

### B5. Wire into message endpoint

**Modify:** `nuxt-app/server/api/chat/message.post.ts`

Same 2-step logic as stream, non-streaming variant. Return `{ text, sources, products, message_id, session_id, conversation_id }`.

### B6. Update types

**Modify:** `nuxt-app/app/types/api.ts`

```ts
export interface Product {
  id: string
  merchant_id: string
  page_id: string | null
  crawl_job_id: string
  name: string
  description: string | null
  price: number | null
  currency: string
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
  sku: string | null
  category: string | null
  image_url: string | null
  source_url: string
  extra_data: Record<string, unknown>
  extraction_confidence: 'high' | 'medium' | 'low'
  missing_fields: string[]
  created_at: string
}
```

**Modify:** `nuxt-app/app/types/database.types.ts` — add `products` Row/Insert/Update types, add `products_extracted` to `crawl_jobs`.

---

## Acceptance Criteria

### Part A — Structured Extraction
- [ ] Migration creates `products` table with RLS, embedding column, quality tracking columns
- [ ] Migration creates `match_products` RPC function (pgvector cosine similarity, merchant_id filter)
- [ ] CF request includes `formats: ["markdown", "json"]` and `jsonOptions` with extraction prompt
- [ ] Crawl worker processes `record.json.items[]` into `products` table
- [ ] Products without `name` are skipped (post-validation)
- [ ] Each product tracks `extraction_confidence` (high/medium/low) and `missing_fields[]`
- [ ] Product embeddings use structured format: `Product: X\nPrice: Y EUR\nCategory: Z`
- [ ] `products_extracted` counter updated on `crawl_jobs`
- [ ] Existing markdown → chunk → embedding pipeline unchanged (chunks still created)
- [ ] `crawl-worker.ts` uses markdown format instead of HTML

### Part B — Validation Pipeline
- [ ] Products retrieved first (top 3, threshold 0.65); chunks used ONLY as fallback (top 5)
- [ ] `validateAndExtract()` uses Haiku for fast validation + fact extraction (~300-500ms)
- [ ] Empty context short-circuits without LLM call
- [ ] When not answerable: soft fallback with suggested products, no Sonnet call
- [ ] When answerable: fact-based prompt sent to Sonnet (not raw chunks)
- [ ] Prompt instructs model to explain "why this matches" for each product
- [ ] SSE contract unchanged (`sources`, `chunk`, `done`)
- [ ] Observability: structured log per query with products/chunks counts, answerable, confidence, latency
- [ ] Messages persisted with `confidence_score` from validation

---

## Agent Routing

### Step 1: backend-developer (Part A — Crawl + DB)
> Read: `.claude/context/data-models.md`, `.claude/context/rag-pipeline.md`, this spec
> Branch: `feat/anti-hallucination-rag`
> Task: Implement A1-A5 (migrations, extraction prompts, crawl worker changes, start endpoint)
> When done: update STATUS.md

### Step 2: backend-developer (Part B — RAG Pipeline)
> Read: this spec, existing `server/utils/chat.ts`, `server/utils/prompt.ts`, `server/api/chat/stream.post.ts`
> Branch: `feat/anti-hallucination-rag` (same branch)
> Task: Implement B1-B6 (products-first retrieval, validator, fact-based prompt, wire endpoints, observability)
> When done: update STATUS.md

### Step 3: security-auditor
> Review: RLS on products table, match_products function permissions, validator input sanitization

### Step 4: playwright-tester
> E2E: crawl produces products, chat returns fact-based answers, fallback works when no data

---

## Required Context

- `.claude/context/data-models.md` — current DB schema
- `.claude/context/rag-pipeline.md` — current RAG flow
- `.claude/context/api-contracts.md` — chat API contracts
- `.claude/specs/anti-hallucination-audit.md` — original audit with 3-step pipeline reference
- `nuxt-app/supabase/migrations/0003_match_chunks_function.sql` — pattern for match_products
- `nuxt-app/server/utils/crawl-worker.ts` — current crawl processing
- `nuxt-app/server/utils/chat.ts` — current chat context building
- `nuxt-app/server/utils/prompt.ts` — current prompt assembly
- `nuxt-app/server/api/chat/stream.post.ts` — current SSE endpoint
