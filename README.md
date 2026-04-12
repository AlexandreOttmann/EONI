# Ecommerce AI SaaS

> Turn any website into an AI-discoverable, agent-powered storefront — with a production-grade RAG pipeline, hybrid vector search, and real-time streaming chat.

Non-Shopify merchants get a turnkey solution: crawl their site, power a RAG chat widget on their pages, and generate LLM-optimized catalog pages so products surface in ChatGPT, Perplexity, and Google AI Overviews.

---

## What It Does

**Content Ingestion** — Crawl any merchant website via Cloudflare Crawler, classify every page by content type (product / brand / FAQ / support), chunk into ~500-token segments, embed with OpenAI, and store in pgvector for retrieval.

**On-Site Agent** — A single `<script>` tag embeds a RAG-powered chat widget (≤30kb, Shadow DOM) on any merchant site. Streams Claude Sonnet responses via SSE, strictly grounded in the merchant's own content.

**AI Visibility** *(Phase 2)* — Auto-generated LLM-optimized static pages with Schema.org markup, `llms.txt`, and a per-merchant MCP endpoint so AI crawlers can discover and cite products natively.

**Automation** *(Phase 2)* — Webhook events (`lead_detected`, `booking_intent`, `crawl_completed`) for n8n, Make, or CRM integrations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Nuxt 4 (SSR dashboard + SSG catalog + server routes) |
| Database + Auth | Supabase (PostgreSQL + pgvector, RLS, Realtime) |
| Vector Search | pgvector with HNSW indexing |
| Crawler | Cloudflare Browser Rendering / Crawl API |
| LLM — Generation | Anthropic Claude Sonnet 4 (streaming) |
| LLM — Classification & Validation | OpenAI GPT-4o-mini |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| Reranker | Jina AI `jina-reranker-v2-base-multilingual` |
| UI | Nuxt UI v3 (Tailwind v4 + Reka UI) |
| Animations | Motion for Vue + GSAP + Lenis |
| Widget | Standalone Vite bundle, Cloudflare R2 |
| Testing | Playwright + axe-core |
| Dev Tooling | TypeScript strict, Zod, VeeValidate, ESLint |

---

## RAG Pipeline & AI Architecture

This is the core engineering investment of the project. The retrieval pipeline went through several iterations to eliminate hallucinations, reduce latency, and scale across arbitrary merchant catalogs.

### 1. Content Classification at Ingest Time

Every crawled page is classified into one of five types before chunking: `product`, `brand`, `faq`, `support`, `other`.

Classification uses a **two-tier strategy** to minimize API spend:
1. **Structural heuristics** (free) — detect product pages by checking for price/schema signals, FAQ pages by Q&A line patterns. Handles the majority of pages instantly.
2. **Batch GPT-4o-mini** — ambiguous pages are batched up to 15 at a time and classified in a single API call with a structured JSON response.

All chunks inherit their parent page's content type, enabling type-filtered retrieval at query time.

```
crawled page
  ├─ hasProducts flag?  → product  (heuristic, free)
  ├─ 3+ Q&A lines?      → faq      (heuristic, free)
  └─ ambiguous          → GPT-4o-mini (batched, 1 call per 15 pages)
```

### 2. Intent-Based Query Routing

Before any vector search, incoming user queries are classified into one of five intents: `product`, `brand`, `support`, `general`, `aggregation`.

Classification again uses a **two-tier strategy**:

1. **Rule-based fast path** — regex patterns cover ~60–70% of typical ecommerce queries without any LLM call (price/size/stock queries → `product`, shipping/returns → `support`, etc.). Language-agnostic patterns handle both English and French.
2. **GPT-4o-mini fallback** — only ambiguous queries that slip through the rules go to the LLM, with `max_tokens: 16` and `temperature: 0` to minimize cost and latency.

Intent classification and query embedding run **in parallel** (`Promise.all`) — zero extra latency for the classification step.

### 3. Hybrid Search — Semantic + Full-Text with RRF

Search combines two complementary signals using **Reciprocal Rank Fusion (RRF)**:

- **Semantic search** — pgvector cosine similarity on 1536-dim OpenAI embeddings via HNSW index
- **Keyword search** — PostgreSQL `tsvector` + GIN index, ranked by `ts_rank_cd`

Both results are fused inside a single Postgres function (`match_records_hybrid`) using the standard RRF formula (k=60), avoiding a round-trip to the application layer. The hybrid approach catches exact keyword matches that semantic search misses (product SKUs, model numbers, proper nouns) while still handling paraphrased or conceptual queries.

```sql
-- RRF fusion inside Postgres (excerpt)
fused AS (
  SELECT COALESCE(s.id, k.id) AS id,
         (COALESCE(1.0 / (60 + s.rank_s), 0.0)
          + COALESCE(1.0 / (60 + k.rank_k), 0.0)) AS score
  FROM semantic s
  FULL OUTER JOIN keyword k ON s.id = k.id
)
```

### 4. HNSW Vector Indexing

Migrated from IVFFlat to **HNSW** (Hierarchical Navigable Small World) indexes for all embedding columns. HNSW provides better recall at lower latency with no training step — critical for catalogs that grow incrementally as new pages are crawled.

### 5. Jina AI Cross-Encoder Reranker

After initial retrieval (top N candidates), results are reranked using **Jina AI's `jina-reranker-v2-base-multilingual`** — a cross-encoder model that scores each (query, document) pair jointly, capturing fine-grained relevance that bi-encoder retrieval misses.

Key implementation decisions:
- **3-second hard timeout** — reranker improves quality but must not block chat. On timeout, the pipeline falls back to original retrieval order gracefully.
- **Multilingual model** — supports merchants with non-English catalogs out of the box.
- **Index order preserved** — reranker returns ranked indices, not copies, keeping the pipeline allocation-efficient.

### 6. Two-Step Anti-Hallucination Validation

Every response goes through a two-step LLM pipeline to eliminate fabricated facts:

**Step 1 — GPT-4o-mini Fact-Checker**
Before generating a response, a dedicated validation call checks whether the retrieved context actually contains an answer:
- Extracts only facts that are **explicitly stated** in the retrieved chunks
- Sets `answerable: true/false` and a `confidence: high | medium | low` score
- Returns structured JSON validated with Zod

**Step 2 — Claude Sonnet Generator**
Only if the context is answerable does the main LLM receive it. The system prompt explicitly forbids inference beyond the provided context. When context is insufficient, the model is instructed to say so rather than speculate.

**Validation skip optimization**: When all retrieved chunks score above a 0.72 cosine similarity threshold, the GPT-4o-mini validation call is skipped entirely — the context is considered high-confidence. This cuts latency on high-recall queries.

```
user query
  ├─ embed query + classify intent (parallel)
  ├─ hybrid search (pgvector + tsvector RRF)
  ├─ rerank top-N candidates (Jina, 3s timeout)
  ├─ GPT-4o-mini fact-check (skip if all similarity > 0.72)
  └─ Claude Sonnet stream → SSE → widget
```

### 7. Aggregation Fast Path

Queries classified as `aggregation` ("list all products", "most popular", "how many destinations") bypass vector search entirely. Instead, a full catalog scan (`list_records_for_aggregation`, up to 150 records) is returned to Claude with an aggregation-optimized prompt. This correctly handles inventory-level questions that vector search handles poorly.

### 8. Supabase-Backed Query Cache

Semantically equivalent queries are cached at the embedding level using a SHA-256 fingerprint of the first 64 embedding dimensions as the cache key. Cache hits return pre-retrieved context instantly and skip retrieval, reranking, and validation entirely.

- 10-minute TTL (configurable per merchant)
- Cached results skip the validation step too
- Multi-instance safe — stored in Postgres, not in-memory

### 9. Distributed Rate Limiting

Rate limiting uses an **atomic Postgres function** (`increment_rate_limit` with `FOR UPDATE`) rather than an in-memory Map. This works correctly across multiple server instances — critical for Nuxt deployed on serverless/edge.

```
in-memory Map       → resets on restart, fails with multiple instances
Postgres FOR UPDATE → atomic, persistent, correct under concurrency
```

### 10. Parallel Query Execution

The retrieval layer runs independent queries concurrently:
- Intent classification + embedding generation: `Promise.all`
- Chunk retrieval + record retrieval: parallel async IIFEs

Measured savings: **50–100ms per request** on typical queries.

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `merchants` | Tenant root — every query filters by `merchant_id` |
| `brands` | Multi-brand support per merchant |
| `records` | Unified content store (products, pages, FAQ entries) with tsvector |
| `record_edges` | Graph relationships between records |
| `indexes` | Merchant-configured search index definitions |
| `chunks` | Raw crawl chunks with 1536-dim embeddings (pgvector) |
| `conversations` / `messages` | Chat history |
| `query_cache` | Embedding-keyed response cache (10-min TTL) |
| `rate_limits` | Distributed request throttling (Postgres atomic) |

All tables enforce `merchant_id` at the RLS level (Supabase Row Level Security). Server routes add explicit `merchant_id` filters on top via the service role key — the client never scopes data.

---

## Project Structure

```
ecommerce-ai-saas/
├── nuxt-app/
│   ├── app/
│   │   ├── components/          Auto-imported Vue components
│   │   ├── composables/         useChat, useCrawl, useBrands, useActiveBrand
│   │   └── pages/dashboard/     brands, products, indexes, chat, crawl
│   ├── server/
│   │   ├── api/                 Nuxt server routes (brands, products, indexes, chat, crawl)
│   │   └── utils/
│   │       ├── chat.ts          Context builder — intent, cache, hybrid search, rerank
│   │       ├── query-router.ts  Rule-based + GPT-4o-mini intent classification
│   │       ├── reranker.ts      Jina AI cross-encoder reranking
│   │       ├── rag-validator.ts GPT-4o-mini fact-checking (anti-hallucination)
│   │       ├── content-classifier.ts  Heuristic + batch LLM page classification
│   │       ├── brand-extractor.ts     LLM-powered brand data extraction
│   │       ├── record-processor.ts    Upserts classified content into records
│   │       ├── crawl-worker.ts        Crawl orchestration + classification pipeline
│   │       ├── embedder.ts            OpenAI embedding generation
│   │       └── chunker.ts             ~500-token chunking with overlap
│   ├── supabase/migrations/     23 migrations — schema, RLS, pgvector functions
│   └── tests/e2e/               Playwright E2E tests + auth fixtures
├── widget/                      Standalone Vite chat widget (Shadow DOM, ≤30kb)
└── .claude/
    ├── agents/                  6 specialized agent definitions
    ├── context/                 STATUS.md, data models, API contracts, RAG pipeline
    └── design-specs/            UI/UX → Frontend handoff artifacts
```

---

## Multi-Agent Development Workflow

This project is built using a **6-agent Claude Code team**, each scoped to a specific layer of the stack. The product-manager agent writes specs with acceptance criteria before any implementation begins; agents hand off via structured context files rather than freeform conversation.

| Agent | Scope |
|---|---|
| `product-manager` | Specs, roadmap, acceptance criteria, STATUS.md |
| `backend-developer` | API routes, Supabase schema, RAG pipeline |
| `frontend-developer` | Vue/Nuxt pages, components, composables, Pinia |
| `ui-ux-designer` | Design system, Tailwind tokens, GSAP, Motion/Vue |
| `security-auditor` | RLS review, auth audit, GDPR, OWASP, a11y |
| `playwright-tester` | E2E tests, fixtures, CI integration |

Coordination runs through `/status`, `/plan`, `/design`, `/review`, `/test` slash commands, each backed by an agent definition file.

---

## Getting Started

```bash
cd nuxt-app && pnpm install
pnpm dev          # Dev server
pnpm typecheck    # Type check (strict)
pnpm lint         # ESLint
pnpm test:e2e     # Playwright E2E
pnpm build        # Production build
```

### Environment Variables

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
JINA_API_KEY=              # Optional — enables cross-encoder reranking
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_CRAWL_API_TOKEN=
```

---

## License

Proprietary. All rights reserved.
