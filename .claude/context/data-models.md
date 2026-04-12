# Data Models

> **Status:** Stub — backend-developer fills exact column types, constraints, indexes, and RLS policies during Phase 1.1 Foundation.

## Supabase Tables

### merchants
Primary entity. One row per SaaS customer.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK, default gen_random_uuid()) | = merchant_id everywhere |
| email | text (unique, not null) | Login email |
| name | text (not null) | Business name |
| domain | text | Merchant website URL |
| widget_config | jsonb | Color, welcome message, position, suggested questions |
| subscription_status | text | free / active / cancelled |
| created_at | timestamptz (default now()) | |
| updated_at | timestamptz | |

### brands
Multi-brand support. One merchant can have many brands.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK, default gen_random_uuid()) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| name | text (not null) | Brand display name |
| domain | text | Brand website URL |
| description | text | Editable, injected into AI context |
| logo_url | text | Brand logo |
| extracted_description | text | Auto-extracted from crawl, shown as suggestion |
| created_at | timestamptz (default now()) | |
| updated_at | timestamptz (default now()) | |

### crawl_jobs
Tracks each crawl run.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| brand_id | uuid (FK brands, nullable) | ON DELETE SET NULL |
| url | text (not null) | Root URL crawled |
| status | text (not null) | pending / running / completed / failed |
| pages_found | int (default 0) | Discovered during crawl |
| pages_crawled | int (default 0) | Successfully fetched |
| chunks_created | int (default 0) | After chunking + embedding |
| error | text | Error message if failed |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz (default now()) | |

### pages
One row per crawled URL.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| brand_id | uuid (FK brands, nullable) | ON DELETE SET NULL |
| crawl_job_id | uuid (FK crawl_jobs, not null) | Which crawl produced this |
| url | text (not null) | Source URL |
| title | text | Page title extracted |
| markdown | text | Full page content as markdown |
| crawled_at | timestamptz | |

### chunks
The atomic unit for RAG. One chunk ~ one product/trip/service.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter + pgvector search filter |
| brand_id | uuid (FK brands, nullable) | ON DELETE SET NULL |
| page_id | uuid (FK pages, not null) | Source page |
| content | text (not null) | Chunk text (~500 tokens) |
| content_type | text (not null, default 'other') | brand / product / faq / support / other |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| metadata | jsonb | price, dates, tags, category, source_url |
| token_count | int | Actual token count |
| created_at | timestamptz (default now()) | |

**Index:** HNSW (migration 0019): `CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);` — replaced IVFFlat for >95% recall without probes tuning.
Must include `WHERE merchant_id = $1` in all queries.

| Column | Type | Notes |
|--------|------|-------|
| embedding_model | text (not null, default 'text-embedding-3-large') | Added in migration 0021; tracks model version for future re-embedding |

### conversations
A chat session.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| brand_id | uuid (FK brands, nullable) | ON DELETE SET NULL |
| session_id | text (not null) | Browser session identifier |
| source | text | widget / dashboard_preview |
| created_at | timestamptz (default now()) | |

### messages
Individual turns in a conversation.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| conversation_id | uuid (FK conversations, not null) | |
| role | text (not null) | user / assistant |
| content | text (not null) | Message text |
| chunks_used | uuid[] | IDs of chunks retrieved for this response |
| confidence_score | float | Similarity score of best chunk match |
| created_at | timestamptz (default now()) | |

### records
Push-indexed records (Algolia-style). Arbitrary JSON objects stored with embeddings for semantic search.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| brand_id | uuid (FK brands, nullable) | ON DELETE SET NULL |
| index_name | text (not null) | Logical collection name (e.g. "products", "articles") |
| object_id | text (not null) | Merchant-assigned stable identifier |
| fields | jsonb (not null) | Arbitrary record data |
| searchable_text | text (not null) | Weighted concatenation of string fields for ilike search |
| embedding | vector(1536) | OpenAI text-embedding-3-small on searchable_text |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**UNIQUE:** `(merchant_id, index_name, object_id)` — safe to upsert.
**Indexes:** merchant_id, (merchant_id, index_name), HNSW cosine on embedding (migration 0019), GIN on searchable_tsv (migration 0018).
**RLS:** select/insert/update/delete scoped to `auth.uid() = merchant_id`.

Additional column (migration 0021):

| Column | Type | Notes |
|--------|------|-------|
| embedding_model | text (not null, default 'text-embedding-3-large') | Tracks model version for future re-embedding |

### record_edges
Similarity edges between records sharing a field value (category/brand/collection). Used for 1-hop neighbor retrieval in RAG.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | |
| source_record_id | uuid (FK records, not null) | |
| target_record_id | uuid (FK records, not null) | |
| edge_type | text (not null) | 'category' \| 'brand' \| 'collection' |
| edge_value | text (not null) | Shared field value |
| created_at | timestamptz | |

**UNIQUE:** `(source_record_id, target_record_id, edge_type)` — idempotent upsert.
**RLS:** select scoped to `auth.uid() = merchant_id`; writes via service_role only.

**`match_records()` RPC** (service_role only):
Takes `query_embedding`, `match_threshold`, `match_count`, `p_merchant_id`, optional `p_index_name`, `p_brand_id`.
Returns `id`, `object_id`, `index_name`, `fields`, `similarity`.

### rate_limits (internal)
Persistent rate limiting counters. Replaced in-memory Map in chat.ts.

| Column | Type | Notes |
|--------|------|-------|
| key | text (PK) | Rate limit key, e.g. `chat:{widgetKey}` |
| count | integer (not null, default 0) | Request count in current window |
| window_start | timestamptz (not null, default now()) | Start of current window |

**RLS:** enabled, no public policies — service_role only via `increment_rate_limit` function.
**Function:** `increment_rate_limit(p_key, p_window_ms, p_max_requests)` → `{ allowed: boolean }` — atomic with FOR UPDATE.

### webhook_configs (Phase 2)
Merchant-configured webhook destinations.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
| event_type | text (not null) | lead_detected / booking_intent / crawl_completed |
| url | text (not null) | Destination URL |
| active | boolean (default true) | |
| created_at | timestamptz (default now()) | |

---

## RLS Policies (To Be Defined)

Every table with `merchant_id` needs:
1. `SELECT` policy: `merchant_id = auth.uid()` (for dashboard/API reads)
2. `INSERT` policy: `merchant_id = auth.uid()` (for creates)
3. `UPDATE` policy: `merchant_id = auth.uid()` (for edits)
4. `DELETE` policy: `merchant_id = auth.uid()` (for removes, if applicable)

Server routes using `serviceRole` key bypass RLS but MUST still filter by `merchant_id` manually.

> **Security-auditor** must review all RLS policies before migration merges.

---

## TypeScript Types

Shared types go in `nuxt-app/types/api.ts`. Backend-developer owns this file.

```typescript
// Stub — to be filled during implementation
export interface Merchant { ... }
export interface CrawlJob { ... }
export interface Page { ... }
export interface Chunk { ... }
export interface Conversation { ... }
export interface Message { ... }

// API request/response types
export interface StartCrawlRequest { url: string }
export interface StartCrawlResponse { jobId: string }
export interface ChatStreamRequest { message: string; sessionId: string; merchantId: string }
// ... etc
```
