# Implementation Spec: Cloudflare /crawl Optimization — 3 Tiers

> **For: backend-developer (Tiers 1-3 backend) + frontend-developer (Tier 3 UI)**
> **Pre-read:** `.claude/context/STATUS.md`, `.claude/context/data-models.md`, `.claude/context/api-contracts.md`

---

## Context

Our CF crawl request currently sends `{ url }` with zero options. CF defaults to HTML format, limit=10, depth=100k. We're leaving massive value on the table. This spec adds proper crawl parameters, AI-powered structured extraction via `jsonOptions`, and a scout-crawl system that auto-detects site type.

**Note:** The `result.records[]` response shape has already been fixed in `crawl-worker.ts` — do not re-address.

---

## Cloudflare /crawl API Reference (key details for implementation)

### Endpoints
- **Start crawl:** `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/crawl`
- **Poll results:** `GET .../crawl/{job_id}` — returns `{ result: { id, status, total, finished, records[], cursor } }`
- **Cancel crawl:** `DELETE .../crawl/{job_id}`

### Job statuses (from CF)
`running` | `completed` | `cancelled_due_to_timeout` | `cancelled_due_to_limits` | `cancelled_by_user` | `errored`

### Response record shape (per page)
```ts
{
  url: string
  status: "queued" | "completed" | "disallowed" | "skipped" | "errored" | "cancelled"
  markdown?: string   // present when formats includes "markdown"
  json?: object       // present when formats includes "json" — AI-extracted structured data
  html?: string       // present when formats includes "html"
  metadata: { status: number, title: string, url: string }
}
```
**Important:** Filter records to `status === "completed"` before processing.

### Polling best practice
Add `?limit=1` during status polling to keep responses lightweight. Only fetch full results (no limit) once `status !== "running"`.

### Pagination
If response exceeds 10MB, a `cursor` value is returned. Pass `?cursor=N` to get next page. **Must handle this for large crawls.**

### CF parameter reference

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `url` | string | required | Starting URL |
| `limit` | number | 10 | Max pages (max 100,000) |
| `depth` | number | 100,000 | Max link depth from start URL |
| `formats` | string[] | ["html"] | Options: `"html"`, `"markdown"`, `"json"`. JSON uses Workers AI. |
| `render` | boolean | true | `false` = fast HTML fetch, no JS execution. Free during beta. |
| `source` | string | "all" | `"all"`, `"sitemaps"`, `"links"` |
| `rejectResourceTypes` | string[] | none | Block: `"image"`, `"media"`, `"font"`, `"stylesheet"` |
| `maxAge` | number | 86400 | Cache TTL in seconds (max 604800) |
| `options.includePatterns` | string[] | none | Wildcard: `*` (no /), `**` (any) |
| `options.excludePatterns` | string[] | none | Higher priority than include |
| `options.includeExternalLinks` | boolean | false | Follow external domains |
| `options.includeSubdomains` | boolean | false | Follow subdomains |
| `jsonOptions.prompt` | string | — | What to extract (required if formats has "json") |
| `jsonOptions.response_format` | object | — | JSON schema for structured output |
| `jsonOptions.custom_ai` | object | — | BYO API key for extraction model |

### `excludePatterns` > `includePatterns`
Exclude always wins. No rules = crawl everything. Include only = only matching URLs indexed.

---

## Tier 1: CF Parameter Optimization

### Agent: backend-developer
### Branch: `feat/crawl-cf-params`

### Files to modify
- [start.post.ts](nuxt-app/server/api/crawl/start.post.ts)

### Task

**1a. Expand the Zod body schema** to accept optional crawl configuration from frontend:

```ts
const bodySchema = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  depth: z.number().int().min(1).max(10).optional().default(5),
  render: z.boolean().optional().default(false),
  includePatterns: z.array(z.string()).max(20).optional(),
  excludePatterns: z.array(z.string()).max(20).optional(),
})
```

**1b. Expand the CF request body** in the `processJob` function. Replace the current bare `{ url }`:

```ts
body: {
  url,
  limit: body.limit,
  depth: body.depth,
  formats: ["markdown"],
  render: body.render,
  rejectResourceTypes: ["image", "media", "font", "stylesheet"],
  options: {
    excludePatterns: [
      // Sensible defaults — always exclude auth/cart/admin pages
      "*/cart*", "*/checkout*", "*/account*", "*/login*",
      "*/signup*", "*/admin*", "*/wp-admin*", "*/my-account*",
      // Merge with merchant-provided patterns
      ...(body.excludePatterns ?? [])
    ],
    ...(body.includePatterns?.length ? { includePatterns: body.includePatterns } : {})
  }
}
```

**1c. Pass body params through** — the `processJob` function signature needs access to parsed body fields. Add a `crawlOptions` param or pass the full body. Ensure `limit`, `depth`, `render`, patterns flow from handler → processJob → CF request.

**1d. Handle CF pagination in `crawl-worker.ts`** — for crawls with many pages, CF returns a `cursor`. The polling loop in `resumeFromCfJob` must paginate:

```ts
// After job completes, fetch all records with pagination
let allRecords: CfRecord[] = []
let cursor: number | undefined

do {
  const params = new URLSearchParams({ status: 'completed' })
  if (cursor) params.set('cursor', String(cursor))

  const result = await $fetch(...)
  allRecords.push(...result.result.records)
  cursor = result.result.cursor
} while (cursor)
```

**1e. Polling optimization** — during the poll-for-status loop, append `?limit=1` so CF returns just the status without full record data. Only fetch full records after terminal status.

### Acceptance criteria
- [ ] CF request includes `limit`, `depth`, `formats`, `render`, `rejectResourceTypes`, `options.excludePatterns`
- [ ] Merchant can pass optional `includePatterns` / `excludePatterns` via POST body
- [ ] Default excludes always applied (cart, checkout, login, admin)
- [ ] Large crawls handle CF cursor pagination
- [ ] Status polling uses `?limit=1` for lightweight checks
- [ ] Existing crawl pipeline still works (pages → chunks → embeddings)

---

## Tier 2: Structured JSON Extraction via `jsonOptions`

### Agent: backend-developer
### Branch: `feat/crawl-json-extraction`
### Depends on: Tier 1

### New files to create

**`nuxt-app/supabase/migrations/0007_products_table.sql`:**

```sql
-- Products table: structured data extracted via CF jsonOptions
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  page_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  crawl_job_id uuid NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,

  name text NOT NULL,
  description text,
  price numeric,
  currency text DEFAULT 'USD',
  availability text CHECK (availability IN ('in_stock', 'out_of_stock', 'preorder', 'unknown')),
  sku text,
  category text,
  image_url text,
  source_url text NOT NULL,
  extra_data jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_crawl_job ON products(crawl_job_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants see own products"
  ON products FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Service role inserts products"
  ON products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role deletes products"
  ON products FOR DELETE
  USING (true);

-- Add products_extracted counter to crawl_jobs
ALTER TABLE crawl_jobs ADD COLUMN products_extracted integer DEFAULT 0;
```

**`nuxt-app/server/utils/extraction-prompts.ts`:**

```ts
export const DEFAULT_EXTRACTION_PROMPT = `Extract product or service information from this page.
For each item found, extract: name, description, price (as a number without currency symbol),
currency (ISO 4217 code like USD, EUR, GBP), availability (in_stock, out_of_stock, or preorder),
SKU or product code if present, category or type, and primary image URL.
If this page does not contain product or service listings, return an empty items array.
Focus on the main content — ignore navigation, footer, and sidebar elements.`

export const DEFAULT_RESPONSE_FORMAT = {
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

### Files to modify

**`nuxt-app/server/api/crawl/start.post.ts`** — change formats to dual:
```ts
formats: ["markdown", "json"],
jsonOptions: {
  prompt: DEFAULT_EXTRACTION_PROMPT,
  response_format: DEFAULT_RESPONSE_FORMAT
}
```

**`nuxt-app/server/utils/crawl-worker.ts`** — after existing page+chunk processing, add product extraction:

```ts
// In processPages, after chunk insertion for each record:
if (record.json?.items?.length) {
  const productRows = record.json.items
    .filter((item: any) => item.name) // must have at least a name
    .map((item: any) => ({
      merchant_id: config.merchantId,
      page_id: pageRow.id,
      crawl_job_id: config.jobId,
      name: item.name,
      description: item.description ?? null,
      price: item.price ?? null,
      currency: item.currency ?? 'USD',
      availability: item.availability ?? 'unknown',
      sku: item.sku ?? null,
      category: item.category ?? null,
      image_url: item.image_url ?? null,
      source_url: record.url,
      extra_data: {} // overflow fields go here
    }))

  if (productRows.length > 0) {
    await client.from('products').insert(productRows)
    // Update products_extracted counter
    const { data: job } = await client.from('crawl_jobs')
      .select('products_extracted').eq('id', config.jobId).single()
    await client.from('crawl_jobs').update({
      products_extracted: (job?.products_extracted ?? 0) + productRows.length
    }).eq('id', config.jobId)
  }
}
```

**Update the CfRecord type** in crawl-worker.ts to include `json`:
```ts
type CfRecord = {
  url: string
  status: string
  markdown?: string
  json?: { items?: Array<Record<string, unknown>> }
  metadata: { status: number, title: string, url: string }
}
```

**`nuxt-app/app/types/api.ts`** — add:
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
  created_at: string
}
```

**`nuxt-app/app/types/database.types.ts`** — add `products` table Row/Insert/Update types + `products_extracted` to crawl_jobs.

### Acceptance criteria
- [ ] Migration creates `products` table with RLS + adds `products_extracted` to `crawl_jobs`
- [ ] CF request includes `formats: ["markdown", "json"]` and `jsonOptions`
- [ ] Records with `json.items[]` produce rows in `products` table
- [ ] Products correctly linked to `merchant_id`, `page_id`, `crawl_job_id`
- [ ] `products_extracted` counter updated on `crawl_jobs`
- [ ] Pages without products (empty items array) are handled gracefully
- [ ] Existing markdown → chunk → embedding pipeline is unchanged
- [ ] `extra_data` column stores any fields not in the typed columns
- [ ] Note: JSON extraction uses CF Workers AI by default — no extra API key needed

---

## Tier 3: Scout Crawl + Adaptive Prompt Generation

### Agent: backend-developer (endpoints + analyzer) → frontend-developer (UI)
### Branch: `feat/crawl-scout`
### Depends on: Tier 2

### New files to create

**`nuxt-app/supabase/migrations/0008_crawl_profiles.sql`:**

```sql
CREATE TABLE crawl_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  site_type text CHECK (site_type IN ('ecommerce', 'restaurant', 'services', 'realestate', 'docs', 'blog', 'generic')),

  json_prompt text,
  json_schema jsonb,

  recommended_depth integer DEFAULT 5,
  recommended_limit integer DEFAULT 100,
  include_patterns text[] DEFAULT '{}',
  exclude_patterns text[] DEFAULT '{}',
  render boolean DEFAULT false,

  webhook_url text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(merchant_id, domain)
);

ALTER TABLE crawl_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants see own profiles"
  ON crawl_profiles FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "Service role manages profiles"
  ON crawl_profiles FOR ALL USING (true);
```

**`nuxt-app/server/api/crawl/scout.post.ts`:**

Scout endpoint that:
1. Validates `{ url }` input
2. Extracts domain from URL
3. Checks if `crawl_profiles` already has a profile for this merchant+domain — if fresh (< 7 days), return it
4. Submits a CF crawl with `{ url, limit: 3, formats: ["markdown"], render: false, rejectResourceTypes: ["image","media","font","stylesheet"] }`
5. Polls CF until complete (same pattern as `resumeFromCfJob` but with shorter timeout — 2 min max for 3 pages)
6. On completion, checks merchant's `webhook_url`:
   - **If webhook configured**: POST `{ merchant_id, domain, sample_pages: records[] }` to webhook URL. Return `{ status: "awaiting_webhook", domain }`
   - **If no webhook**: call `analyzeSite(records)` (see below)
7. Upsert result into `crawl_profiles` (ON CONFLICT merchant_id, domain)
8. Return `{ profile: CrawlProfile }` with site_type, recommended config, generated prompt

**`nuxt-app/server/utils/scout-analyzer.ts`:**

Uses Anthropic SDK (already a project dependency for chat) to analyze sample pages:

```ts
import Anthropic from '@anthropic-ai/sdk'

export interface ScoutResult {
  site_type: string
  json_prompt: string
  json_schema: object
  recommended_depth: number
  recommended_limit: number
  include_patterns: string[]
  exclude_patterns: string[]
  render: boolean
}

export async function analyzeSite(
  sampleRecords: CfRecord[],
  domain: string,
  anthropicApiKey: string
): Promise<ScoutResult> {
  const client = new Anthropic({ apiKey: anthropicApiKey })

  const sampleContent = sampleRecords
    .map(r => `--- PAGE: ${r.url} ---\n${r.markdown?.slice(0, 3000) ?? '(no content)'}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Analyze these sample pages from ${domain} and determine:

1. **site_type**: One of: ecommerce, restaurant, services, realestate, docs, blog, generic
2. **json_prompt**: Write the optimal extraction prompt for Cloudflare's jsonOptions. This prompt tells an AI what structured data to extract from each page. Be specific to this site type — e.g., for a restaurant, extract dish names, prices, dietary info; for real estate, extract address, price, bedrooms, sqft.
3. **json_schema**: A JSON schema (json_schema format) matching your prompt's expected output. Use an "items" array wrapper.
4. **recommended_depth**: How deep to crawl (1-10). Product listing sites need 2-3, deep docs need 5+.
5. **recommended_limit**: How many pages to crawl (10-1000).
6. **include_patterns**: URL patterns to include (e.g., "/products/**"). Empty array if no restriction needed.
7. **exclude_patterns**: URL patterns to exclude beyond defaults (cart, checkout, login, admin are already excluded).
8. **render**: true if the site is a JS SPA that needs browser rendering, false for static/SSR sites.

Sample pages:
${sampleContent}

Respond with ONLY valid JSON matching the ScoutResult interface. No markdown fences.`
    }]
  })

  return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}')
}
```

**`nuxt-app/server/api/webhooks/crawl-scouted.post.ts`:**

Webhook callback endpoint for n8n:
1. Validate incoming payload with Zod: `{ merchant_id, domain, site_type, json_prompt, json_schema, ... }`
2. Verify merchant_id exists
3. Upsert into `crawl_profiles`
4. Optionally auto-trigger full crawl if `auto_start: true` in payload
5. Return `{ success: true, profile_id }`

**Security:** This endpoint should validate a webhook secret (stored per merchant or globally). Add `x-webhook-secret` header check.

**`nuxt-app/server/api/crawl/start.post.ts`** — modify to load profile:

Before submitting to CF, check for an existing crawl_profile for this domain:
```ts
const domain = new URL(body.url).hostname
const { data: profile } = await client
  .from('crawl_profiles')
  .select('*')
  .eq('merchant_id', merchantId)
  .eq('domain', domain)
  .maybeSingle()

// Use profile config if available, otherwise fall back to defaults
const cfBody = {
  url: body.url,
  limit: profile?.recommended_limit ?? body.limit,
  depth: profile?.recommended_depth ?? body.depth,
  formats: ["markdown", "json"],
  render: profile?.render ?? body.render,
  rejectResourceTypes: ["image", "media", "font", "stylesheet"],
  jsonOptions: {
    prompt: profile?.json_prompt ?? DEFAULT_EXTRACTION_PROMPT,
    response_format: profile?.json_schema ?? DEFAULT_RESPONSE_FORMAT
  },
  options: {
    excludePatterns: [
      "*/cart*", "*/checkout*", "*/account*", "*/login*",
      "*/signup*", "*/admin*", "*/wp-admin*",
      ...(profile?.exclude_patterns ?? []),
      ...(body.excludePatterns ?? [])
    ],
    ...(
      (profile?.include_patterns?.length || body.includePatterns?.length)
        ? { includePatterns: [...(profile?.include_patterns ?? []), ...(body.includePatterns ?? [])] }
        : {}
    )
  }
}
```

### Frontend (for frontend-developer)

**`nuxt-app/app/composables/useCrawl.ts`** — add:
```ts
scoutProfile: ref<CrawlProfile | null>(null)
isScoutLoading: ref(false)

async function scoutSite(url: string) {
  isScoutLoading.value = true
  try {
    const { profile } = await $fetch('/api/crawl/scout', { method: 'POST', body: { url } })
    scoutProfile.value = profile
    return profile
  } finally {
    isScoutLoading.value = false
  }
}
```

**`nuxt-app/app/pages/dashboard/crawl.vue`** — 2-step flow:
1. User enters URL → clicks "Analyze Site" → calls `scoutSite(url)`
2. Shows scout results: detected site type badge, extraction prompt preview (editable textarea), recommended config
3. User reviews/tweaks → clicks "Start Full Crawl" → calls `startCrawl(url)` (which now uses the profile)
4. Falls back to single-step flow if scout fails or user skips

**`nuxt-app/app/pages/dashboard/settings.vue`** — add webhook URL field in settings:
- Input for `webhook_url` under an "Advanced" / "Integrations" section
- Saved to merchant profile or crawl_profiles table

### Types (`nuxt-app/app/types/api.ts`)
```ts
export interface CrawlProfile {
  id: string
  merchant_id: string
  domain: string
  site_type: string
  json_prompt: string | null
  json_schema: Record<string, unknown> | null
  recommended_depth: number
  recommended_limit: number
  include_patterns: string[]
  exclude_patterns: string[]
  render: boolean
  webhook_url: string | null
  created_at: string
  updated_at: string
}

export interface ScoutResponse {
  profile: CrawlProfile
  status?: 'awaiting_webhook'
}
```

### Acceptance criteria
- [ ] `POST /api/crawl/scout` returns detected site_type + generated extraction config
- [ ] Scout uses Claude Sonnet to analyze 3 sample pages
- [ ] Profile cached in `crawl_profiles` (re-used if < 7 days old)
- [ ] `POST /api/crawl/start` loads profile and uses its jsonOptions/config
- [ ] Webhook flow: if `webhook_url` set, sample pages POSTed there instead of in-app analysis
- [ ] `POST /api/webhooks/crawl-scouted` accepts webhook callback, upserts profile
- [ ] Webhook endpoint validates secret header
- [ ] Frontend shows 2-step flow: Analyze → Review → Full Crawl
- [ ] User can edit the generated prompt before starting full crawl
- [ ] Settings page has webhook URL field
- [ ] Full crawl still works without scouting (uses default prompt from Tier 2)

---

## Tier 4: n8n Integration — AI Agent for Smart Extraction Prompts

### Overview

n8n acts as an external AI orchestrator that receives scout crawl samples via webhook, reasons about the site's content, and generates optimized `jsonOptions` prompts — potentially better than the built-in Claude analysis because n8n workflows can:
- Chain multiple AI calls (analyze → research → generate → validate)
- Use different models per step (cheap model for classification, powerful model for prompt writing)
- Include human-in-the-loop approval steps
- Integrate external data (Google Shopping categories, competitor schemas, industry-specific taxonomies)
- Run custom logic (regex pattern detection, URL structure analysis)

### n8n Workflow Setup

**Workflow: "Crawl Scout Analyzer"**

#### Trigger Node
- **Type:** Webhook
- **Method:** POST
- **Path:** `/crawl-scout-analyzer`
- **Authentication:** Header Auth → match `x-webhook-secret` against a shared secret
- **Expected payload:**
```json
{
  "merchant_id": "uuid",
  "domain": "example.com",
  "sample_pages": [
    {
      "url": "https://example.com/page1",
      "markdown": "...(truncated to ~3000 chars per page)...",
      "metadata": { "title": "...", "status": 200 }
    }
  ],
  "callback_url": "https://your-app.com/api/webhooks/crawl-scouted"
}
```

#### Node 1: "Classify Site Type" (AI Agent / Code node)
- **Input:** `sample_pages[].markdown`
- **Model:** Fast/cheap (e.g., Haiku, GPT-4o-mini)
- **Prompt:** "Given these page samples from {{domain}}, classify the site as one of: ecommerce, restaurant, services, realestate, docs, blog, generic. Return just the type."
- **Output:** `site_type` string

#### Node 2: "Route by Type" (Switch node)
- Branch on `site_type` to type-specific prompt generation nodes
- Each branch can have specialized logic:
  - **ecommerce** → extract products, variants, prices, reviews
  - **restaurant** → extract menu items, dietary flags, allergens, sections
  - **services** → extract service name, pricing tiers, features, SLAs
  - **realestate** → extract listings, address, price, bedrooms, sqft, amenities
  - **docs** → extract API endpoints, code samples, versioning
  - **blog** → extract article metadata, author, publish date, topics

#### Node 3: "Generate Extraction Prompt" (AI Agent node)
- **Model:** Powerful (Claude Sonnet/Opus, GPT-4o)
- **System prompt:**
```
You are an expert at writing data extraction prompts for Cloudflare's Browser Rendering jsonOptions.
Your prompt will be sent to an AI model that reads rendered web pages and extracts structured data.

Rules:
- Be extremely specific about what fields to extract
- Reference the actual HTML/content patterns you see in the samples
- Include fallback instructions (e.g., "if price is not shown, set to null")
- Mention site-specific quirks (e.g., "prices on this site include VAT")
- Tell the AI to ignore navigation, footers, cookie banners
- Output must match the JSON schema you'll also generate
```
- **User prompt:** Contains the sample pages + site_type + any merchant preferences
- **Output:** `json_prompt` string

#### Node 4: "Generate JSON Schema" (Code node)
- Takes `site_type` and the generated prompt
- Builds a `response_format` JSON schema matching the prompt's expected output
- Can use predefined schema templates per site type, then customize

#### Node 5: "Recommend Crawl Config" (Code node)
- Logic based on `site_type` and URL patterns observed in samples:
```javascript
const config = {
  ecommerce: { depth: 3, limit: 500, include: ["/products/**", "/collections/**", "/shop/**"], render: false },
  restaurant: { depth: 2, limit: 50, include: ["/menu/**", "/our-menu/**"], render: false },
  services: { depth: 3, limit: 200, include: ["/services/**", "/pricing/**"], render: false },
  realestate: { depth: 3, limit: 1000, include: ["/listings/**", "/properties/**", "/for-sale/**"], render: true },
  docs: { depth: 5, limit: 500, include: ["/docs/**", "/api/**", "/reference/**"], render: false },
  blog: { depth: 2, limit: 300, include: ["/blog/**", "/posts/**", "/articles/**"], render: false },
  generic: { depth: 3, limit: 100, include: [], render: false }
}
return config[site_type] ?? config.generic
```

#### Node 6: "Callback to App" (HTTP Request node)
- **Method:** POST
- **URL:** `{{ $json.callback_url }}` (from trigger payload) → hits `/api/webhooks/crawl-scouted`
- **Headers:** `x-webhook-secret: <shared_secret>`
- **Body:**
```json
{
  "merchant_id": "{{merchant_id}}",
  "domain": "{{domain}}",
  "site_type": "{{site_type}}",
  "json_prompt": "{{generated_prompt}}",
  "json_schema": { ... },
  "recommended_depth": 3,
  "recommended_limit": 500,
  "include_patterns": ["/products/**"],
  "exclude_patterns": ["/blog/**"],
  "render": false,
  "auto_start": false
}
```

### n8n Deployment Options

1. **Self-hosted (recommended for dev):** `docker run -p 5678:5678 n8nio/n8n` — free, full control
2. **n8n Cloud:** Managed hosting, starts at $20/mo, built-in credential management
3. **Railway/Render:** One-click deploy templates available

### App-Side Configuration

**Merchant settings** (in `nuxt-app/app/pages/dashboard/settings.vue`):

Under an "Integrations" or "Advanced" section:
- **Webhook URL** field — paste the n8n webhook trigger URL (e.g., `https://your-n8n.com/webhook/crawl-scout-analyzer`)
- **Webhook Secret** field — shared secret for `x-webhook-secret` header validation
- Both values saved to the merchant's profile (or `crawl_profiles` table)

When `webhook_url` is set on the merchant, the scout endpoint (`/api/crawl/scout`) sends sample pages to n8n instead of running the built-in Claude analyzer. This makes the extraction prompt generation pluggable — merchants who don't configure n8n get the default in-app analysis.

### Why This Architecture

| Concern | In-app (Tier 3 default) | n8n (Tier 4) |
|---------|------------------------|--------------|
| Speed | Single Claude call ~3s | Multi-step ~10-15s |
| Quality | Good generic prompts | Site-type-specific, refined prompts |
| Cost | 1 API call per scout | Multiple calls, but only per scout (not per page) |
| Flexibility | Fixed logic | Visual workflow editor, easy to iterate |
| Human review | No | Can add approval steps before callback |
| External data | No | Can query product taxonomies, competitor schemas |
| Maintenance | Code deploys | Visual drag-and-drop changes |

### Acceptance criteria
- [ ] n8n workflow template documented with node types and configuration
- [ ] Webhook trigger validates `x-webhook-secret`
- [ ] Workflow produces `site_type`, `json_prompt`, `json_schema`, crawl config
- [ ] Callback hits `/api/webhooks/crawl-scouted` with correct payload
- [ ] App falls back to in-app analysis when no webhook URL configured
- [ ] Settings page exposes webhook URL + secret fields
- [ ] n8n workflow JSON exportable as template for easy merchant onboarding

---

## Implementation sequence

| Step | Agent | Task | Branch |
|------|-------|------|--------|
| 1 | backend-developer | Tier 1: CF params + pagination + poll optimization | `feat/crawl-cf-params` |
| 2 | backend-developer | Tier 2: products migration + extraction-prompts + json processing | `feat/crawl-json-extraction` |
| 3 | backend-developer | Tier 3: crawl_profiles migration + scout endpoint + analyzer + webhook | `feat/crawl-scout` |
| 4 | frontend-developer | Tier 3 UI: scout flow in crawl.vue + useCrawl + settings webhook field | `feat/crawl-scout` |
| 5 | — | Tier 4: Set up n8n workflow (manual), configure webhook in settings | — |
| 6 | security-auditor | Review: RLS on products + crawl_profiles, webhook secret validation, Zod on all inputs | — |
| 7 | playwright-tester | E2E: crawl with params, products extraction, scout → full crawl flow | — |

---

## Post-task: update STATUS.md

After each tier, update `.claude/context/STATUS.md`:
- Add `products` table and `crawl_profiles` to Phase 1.2 "What exists"
- Mark new tasks ✅
- Add file paths for new utils/endpoints
