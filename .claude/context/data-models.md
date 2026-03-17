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

### crawl_jobs
Tracks each crawl run.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
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
| page_id | uuid (FK pages, not null) | Source page |
| content | text (not null) | Chunk text (~500 tokens) |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| metadata | jsonb | price, dates, tags, category, source_url |
| token_count | int | Actual token count |
| created_at | timestamptz (default now()) | |

**Index:** `CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`
Must include `WHERE merchant_id = $1` in all queries.

### conversations
A chat session.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| merchant_id | uuid (FK merchants, not null) | RLS filter |
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
