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
| GET | /api/crawl/status/[jobId] | required | ✅ | Poll crawl job progress |
| GET | /api/crawl/jobs | required | ✅ | List merchant's last 20 crawl jobs |

**Start Crawl Request:**
```typescript
{ url: string }  // z.string().url()
```

**Start Crawl Response:**
```typescript
{ job_id: string; status: 'pending' }
```

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
| GET | /api/indexes | ✅ | List all indexes with count + updatedAt |
| GET | /api/indexes/:indexName/records | ✅ | Paginated record list with optional search |
| PUT | /api/indexes/:indexName/records/:objectId | ✅ | Full upsert + re-embed |
| PATCH | /api/indexes/:indexName/records/:objectId | ✅ | Partial field merge + re-embed |
| POST | /api/indexes/:indexName/records/batch | ✅ | Batch upsert up to 1000 records |
| DELETE | /api/indexes/:indexName/records/:objectId | ✅ | Delete one record + its edges |
| DELETE | /api/indexes/:indexName/records | ✅ | Clear entire index for this merchant |

**GET /api/indexes response:**
```typescript
{ indexes: Array<{ indexName: string, count: number, updatedAt: string }> }
```

**GET /api/indexes/:indexName/records query params:**
- `page` (default 1), `limit` (default 24, max 100), `search` (ilike on searchable_text)

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
