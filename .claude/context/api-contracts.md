# API Contracts

> **Status:** Auth routes ✅ implemented. Crawl, Chat, Merchant routes ✅ implemented (Phase 1.2 + 1.3).

All routes live in `nuxt-app/server/api/`. Every route uses Zod for input validation.

---

## Auth Routes

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /api/auth/login | none | ✅ | Email + password login via Supabase |
| POST | /api/auth/signup | none | ✅ | New merchant registration |
| GET | /api/auth/callback | none | ✅ | OAuth callback (Google) |
| GET | /api/auth/me | required | ✅ | Current merchant profile |
| POST | /api/auth/logout | required | ✅ | End session |

---

## Crawl Routes

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /api/crawl/start | required | ✅ | Trigger Cloudflare /crawl for merchant's domain |
| POST | /api/crawl/discover | required | ✅ | Fetch sitemap + group URLs by path prefix |
| GET | /api/crawl/status/[jobId] | required | ✅ | Poll crawl job progress |
| GET | /api/crawl/jobs | required | ✅ | List merchant's last 20 crawl jobs |

**Discover Request:**
```typescript
{
  url: string        // z.string().url()
  brand_id?: string  // uuid — when set, same brand-domain guard as /crawl/start
                     // (rejects with `brand_domain_mismatch` on mismatch; does
                     // NOT auto-claim — discover is read-only)
}
```

**Start Crawl Request:**
```typescript
{
  url: string                // z.string().url()
  limit?: number             // 1..500, default 100
  includePatterns?: string[] // max 20
  excludePatterns?: string[] // max 20
  brand_id?: string          // uuid — optional, enables brand-domain guard
}
```

**Start Crawl Response:**
```typescript
{
  job_id: string
  status: 'pending'
  brand_domain_claimed?: string  // present ONLY when this crawl first-bound
                                 // the brand's domain (brand.domain was null
                                 // and has now been set to this value). UI
                                 // should toast "Brand domain set to ${value}".
}
```

**Brand-domain guard (Phase A):** When `brand_id` is supplied, the server computes the URL's root hostname (`extractRootDomain` in `server/utils/domain.ts` — strips protocol + leading `www.`) and enforces:

- `brand.domain === null` → auto-claim, `UPDATE brands SET domain = <crawl_domain>`, respond with `brand_domain_claimed`.
- `brand.domain === crawlDomain` → proceed normally.
- `brand.domain !== crawlDomain` → reject with HTTP 400, `statusMessage: 'brand_domain_mismatch'`, and structured `data`:

  ```typescript
  interface BrandDomainMismatchError {
    code: 'brand_domain_mismatch'
    brand_id: string
    brand_domain: string         // legacy single-domain field (= brand_domains[0] or '')
    brand_domains: string[]      // full list of domains bound to the brand (Phase B+)
    crawl_domain: string         // what the client tried to crawl
    message: string              // human-readable, safe to show in a modal
    suggested_brand_name: string // title-cased from crawl_domain, e.g. "Evaneos"
  }
  ```

  As of Phase B, the guard checks `brand.domains.includes(crawlDomain)` instead of single-column equality. Auto-claim on first crawl writes `domains = [crawlDomain]`. Both `brand_domain` and `brand_domains` are returned in the error payload; new clients should prefer `brand_domains`.

  The frontend catches `error.data?.code === 'brand_domain_mismatch'` and opens a recovery modal offering to create a new brand with `name = suggested_brand_name` and `domain = crawl_domain`.

When `brand_id` is not supplied, the guard is skipped and nullable-brand crawls proceed as before.

**Crawl Status Response:**
```typescript
{ job: CrawlJob }
// CrawlJob.status: 'pending' | 'running' | 'completed' | 'failed'
```

**Crawl Jobs Response:**
```typescript
{ jobs: CrawlJob[] }
```

**Behavior:** `POST /api/crawl/start` returns immediately with `job_id`. Background `processJob()` runs fire-and-forget: calls Cloudflare /crawl, chunks markdown, calls OpenAI embeddings, stores chunks with pgvector embeddings. Returns 409 if a pending/running job already exists.

### POST /api/crawl/jobs/[id]/reassign-brand

Move an existing crawl job (and all its pages, chunks, records) from its current brand to a different brand under the same merchant. Phase B.

**Request:**
```typescript
{ target_brand_id: string }  // uuid, must belong to the same merchant
```

**Success (200):**
```typescript
{
  job_id: string
  target_brand_id: string
  counts: { pages: number, chunks: number, records: number }
}
```

**Errors:**
- `400 brand_domain_mismatch` — target brand's `domains` array does not include the crawl job's root domain. Payload is the same `BrandDomainMismatchError` shape used by `/api/crawl/start`.
- `404` — crawl job not found or owned by a different merchant.

Implemented on top of the `reassign_crawl_brand` Postgres RPC (single-transaction move + `query_cache` flush).

---

## Brand Routes

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| GET | /api/brands | required | ✅ | List merchant's brands |
| POST | /api/brands | required | ✅ | Create brand |
| GET | /api/brands/[id] | required | ✅ | Get brand by id |
| PATCH | /api/brands/[id] | required | ✅ | Update brand |
| DELETE | /api/brands/[id] | required | ✅ | Delete brand |

**POST /api/brands body (Phase B):**
```typescript
{
  name: string
  domains?: string[]  // preferred: max 20, normalized + deduped server-side
  domain?: string     // legacy convenience: mapped to `domains = [domain]` if domains absent
  description?: string
  logo_url?: string
}
```
Writes to the `brands.domains` array column. `brands.domain` is a generated column (`GENERATED ALWAYS AS (domains[1]) STORED`) and is read-only.

**PATCH /api/brands/[id] body (Phase B):**
```typescript
{
  name?: string
  domains?: string[]  // preferred: max 20, normalized via extractRootDomain + deduped
  domain?: string     // legacy: accepted for back-compat, maps to domains = [domain]
  description?: string
  logo_url?: string
}
```

---

## Chat Routes

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /api/chat/stream | widget-key | ✅ | SSE streaming chat response |
| GET | /api/chat/history/[sessionId] | required | ✅ | Conversation history for dashboard |

**Chat Stream Request:**
```typescript
{
  message: string      // min 1, max 4000
  session_id: string   // browser session identifier
  widget_key: string   // uuid — merchant resolved server-side from this
  brand_id?: string    // uuid — optional, scopes retrieval to a specific brand
}
```

**Security:** `merchant_id` is NEVER trusted from the client. It is always derived server-side from `widget_key` lookup on `merchants.widget_config->>'widget_key'`. All DB queries include `.eq('merchant_id', merchantId)` explicitly.

**Chat Stream Response:** SSE events in this order:
```
event: sources
data: {"chunks": [{"id": "uuid", "content": "...", "similarity": 0.87}], "products": [{"id": "uuid", "name": "...", "price": 100, "currency": "EUR", "source_url": "...", "similarity": 0.85}]}

event: chunk
data: {"text": "partial response text"}

event: done
data: {"message_id": "uuid"}

event: error
data: {"message": "error description"}
```

**2-step validation pipeline:** The stream endpoint uses intent-based retrieval: a query router (keyword rules + Haiku fallback) classifies intent as product/brand/support/general, then retrieves accordingly (products RPC for product intent, content-typed chunks for brand/support, general fallback for ambiguous). A Haiku-based validator determines answerability. If not answerable, a soft fallback is returned with suggested products (no Sonnet call). If answerable, a fact-based prompt is sent to Sonnet. Brand context is always injected when brand_id is provided.

**Chat Message Response:**
```typescript
{
  text: string
  sources: Array<{ id: string, content: string, similarity: number }>
  products: ChatProductResult[]  // products retrieved for this query
  message_id: string
  session_id: string
  conversation_id: string
}
```

**Chat History Response:**
```typescript
{ conversation: Conversation; messages: Message[] }
```

---

## Merchant Routes

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| GET | /api/merchant/config | required | ✅ | Get merchant profile + widget config |
| PATCH | /api/merchant/config | required | ✅ | Update name, domain, widget config |
| GET | /api/merchant/analytics | required | ✅ | Conversation stats, top questions |

**Merchant Config PATCH Request:**
```typescript
{
  name?: string                    // min 1, max 100
  domain?: string                  // must be valid URL
  widget_config?: {
    primary_color?: string         // /^#[0-9a-f]{6}$/i
    welcome_message?: string       // max 200 chars
    position?: 'bottom-right' | 'bottom-left'
  }
}
```
Note: `widget_key` inside `widget_config` is always preserved server-side. Client cannot overwrite it.

**Analytics Response:**
```typescript
{
  total_conversations: number
  total_messages: number
  top_questions: Array<{ content: string; count: number }>  // top 10
  no_answer_rate: number  // 0.0–1.0, ratio of low-confidence assistant messages
}
```

---

## Index / Records Routes

Algolia-style push indexing API. Auth: session (`serverSupabaseUser`) required for all routes.

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /api/indexes | ✅ | List indexes (optionally brand-scoped) with count + updatedAt |
| POST | /api/indexes | ✅ | Create index for `(merchant_id, brand_id, name)` |
| GET | /api/indexes/:indexName/records | ✅ | Paginated record list with optional search |
| PUT | /api/indexes/:indexName/records/:objectId | ✅ | Full upsert + re-embed |
| PATCH | /api/indexes/:indexName/records/:objectId | ✅ | Partial field merge + re-embed |
| POST | /api/indexes/:indexName/records/batch | ✅ | Batch upsert up to 1000 records |
| DELETE | /api/indexes/:indexName/records/:objectId | ✅ | Delete one record + its edges |
| DELETE | /api/indexes/:indexName/records | ✅ | Clear entire index for this merchant |

**GET /api/indexes query params (Phase B):**
- `brand_id` (uuid, optional) — filter to indexes scoped to this brand. Omit to return all.

**GET /api/indexes response:**
```typescript
{ indexes: Array<{ indexName: string, brandId: string | null, count: number, updatedAt: string }> }
```

**POST /api/indexes body (Phase B):**
```typescript
{ name: string, brand_id: string }  // brand_id is REQUIRED and ownership-validated
```

**GET /api/indexes/:indexName/records query params:**
- `page` (default 1), `limit` (default 24, max 100), `search` (ilike on searchable_text)
- `brand_id` (uuid, optional) — filter records by top-level brand_id column
- `category` (string, optional) — filter records by `fields->>category` jsonb text value

**GET /api/indexes/:indexName/records response:**
```typescript
{ records: IndexRecord[], total: number }
```

**PUT/PATCH body:**
```typescript
{ fields: Record<string, unknown>, brand_id?: string }  // PATCH: brand_id ignored
```

**POST batch body:** `Array<{ objectID: string, ...fields }>` (max 1000)
**POST batch response:** `{ taskID, indexName, objectsCount, status: 'processed' }`

**RAG integration:** `match_records()` is called on every chat query alongside `match_chunks` / `match_products`. Top results have their 1-hop `record_edges` neighbors fetched and included as an "Indexed Records" section in both prompt builders.

---

## MCP Routes (Phase 2)

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /api/mcp/:slug/search | MCP auth | ⬜ | Product search for AI agents |

---

## Webhook Routes (Phase 2)

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| GET | /api/webhooks/configs | required | ⬜ | List webhook configurations |
| POST | /api/webhooks/configs | required | ⬜ | Create webhook config |
| PATCH | /api/webhooks/configs/:id | required | ⬜ | Update webhook config |
| DELETE | /api/webhooks/configs/:id | required | ⬜ | Delete webhook config |

---

## Error Response Format

All error responses follow:
```typescript
{
  statusCode: number
  message: string
  data?: any  // validation errors, etc.
}
```

Never leak stack traces, SQL errors, or internal details in error responses.

---

## Auth Mechanism

- Supabase Auth handles session management
- Dashboard routes use `serverSupabaseUser(event)` to get the authenticated user
- Service role routes use `serverSupabaseServiceRole(event)` for admin operations
- Widget chat route authenticates via `widget_key` (UUID stored in `merchants.widget_config->>'widget_key'`) — no user session required
