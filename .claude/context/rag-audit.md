# Technical Due Diligence Audit: RAG Implementation

**Date:** April 11, 2026 | **Scope:** Full RAG pipeline (ingestion, storage, retrieval, validation, response generation)

---

## 1. Executive Summary

**Overall Grade: B- (Solid MVP, Not Production-Scale-Ready)**

Well-architected early-stage RAG with strong fundamentals in multi-tenancy, anti-hallucination, and hybrid retrieval. Several architectural choices appropriate for MVP will become liabilities at 10-100x growth.

**Top 3 Strengths:**
1. Robust multi-tenancy: `merchant_id` on every query + RLS + service-role-only match functions with explicit `REVOKE`
2. Anti-hallucination pipeline: 2-stage fact validation (gpt-4o-mini) with Zod-validated output, graceful degradation, short-circuit on zero context
3. Hybrid retrieval: RRF (k=60, 4x oversample) combining pgvector cosine + BM25 tsvector in a single SQL function, plus graph-based 1-hop neighbor expansion

**Top 3 Risks:**
1. O(n^2) edge building is a data-proportional time bomb (Critical)
2. IVFFlat indexes degrade recall past ~50K vectors/merchant (High)
3. In-memory rate limiting is useless in multi-instance deployment (High)

---

## 2. Architecture Assessment

### 2.1 Data Flow

**Ingestion:**
```
Crawl Request -> CF Browser Rendering -> Polling (20s/20min)
  -> Content Classification (heuristic + gpt-4o-mini batch)
  -> Chunking (H2 > para > sentence, ~500 tokens)
  -> Embedding (text-embedding-3-small, 1536-dim, batch 2048)
  -> Storage (chunks + records tables, pgvector + tsvector)
  -> Product Extraction -> Edge Building (category/brand/collection)
```

**Query:**
```
User Query -> Intent Classification (gpt-4o-mini, ~150ms)
           -> Embedding (text-embedding-3-small, ~100ms)
  -> Chunks: intent-routed content_type filter, cosine >= 0.35, top 5
  -> Records: hybrid RRF (vector + BM25), top 5
  -> 1-hop Neighbor Expansion
  -> Fact Validation (gpt-4o-mini, ~300ms)
  -> Response (Claude Sonnet 4, streaming SSE, 1024 tokens)
```

**Verdict:** Clean linear flow with good separation of concerns. Intent + embedding run in `Promise.all` (good). But chunks and records retrieval run sequentially -- should be parallel.

### 2.2 Component Quality Breakdown

| Component | File | Grade | Notes |
|-----------|------|-------|-------|
| Chunker | `server/utils/chunker.ts` | B | Good hierarchical splitting; heuristic token count (words/1.3) is imprecise for non-English |
| Content Classifier | `server/utils/content-classifier.ts` | A- | Cost-efficient 2-stage (free heuristics + LLM batch); graceful fallback |
| Query Router | `server/utils/query-router.ts` | B+ | Simple, fast (16 max_tokens); 4 intents may be too coarse for product sub-intents |
| RAG Validator | `server/utils/rag-validator.ts` | A | Strongest component. Zod validation, short-circuit, fact extraction with sources |
| Record Processor | `server/utils/record-processor.ts` | C+ | Good searchable text building; O(n^2) edge building is the biggest risk in the codebase |
| Hybrid Search SQL | `migrations/0018_hybrid_search.sql` | A- | Correct RRF implementation; 4x oversample; SECURITY DEFINER + proper REVOKE |
| Prompt Engineering | `server/utils/prompt.ts` | B+ | 3 prompt variants; explicit anti-hallucination rules; fixed 6-msg history is simplistic |
| Stream Endpoint | `server/api/chat/stream.post.ts` | B | Correct SSE pattern; new Anthropic client per request is wasteful |

### 2.3 Database Design

**What's right:**
- `UNIQUE (merchant_id, index_name, object_id)` enables clean upserts
- `SECURITY DEFINER` + `REVOKE/GRANT` on all match functions
- `searchable_tsv` auto-sync via trigger
- `'simple'` text search config = language-agnostic (correct for multi-language merchants)

**What needs attention:**
- IVFFlat with `lists=100` -- adequate for <100K vectors, degrades after
- `ivfflat.probes=10` set in `match_chunks` but NOT in `match_chunks_by_type` -- chunks retrieval via the type-filtered path may use default `probes=1` (very poor recall)
- No embedding model version column -- model upgrade requires full re-embedding with no migration path

---

## 3. Scalability Analysis

### At 10x (100 merchants, ~100K total vectors)

| Aspect | Status | Notes |
|--------|--------|-------|
| Vector search | OK | IVFFlat handles 100K adequately |
| Edge table | Strained | 500 products x 20 categories (avg 25/cat) = ~12K edges/merchant = 1.2M total |
| Rate limiting | Broken | Not shared across instances; resets on restart |
| LLM costs | ~$535/mo | Manageable at this scale |

### At 100x (1K merchants, ~1M total vectors)

| Aspect | Status | Notes |
|--------|--------|-------|
| Vector search | Degraded | IVFFlat recall drops to ~70-80%. HNSW needed. |
| Edge table | Critical | 2K products, 50 in "shoes" = 2,450 edges for one category. Total edges per merchant: 100K+ |
| LLM rate limits | Blocking | ~3K LLM calls/sec exceeds typical gpt-4o-mini RPM limits |
| Query caching | Critical gap | 30-50% of chat queries are near-duplicates ("shipping policy", "returns") -- all re-embedded |
| Crawl worker | Strained | Runs in Nuxt server process (fire-and-forget); no job queue |

### At 1000x (10K merchants, ~10M+ vectors)

| Aspect | Status | Notes |
|--------|--------|-------|
| pgvector | Architecturally incompatible | Single Supabase instance can't serve 10M vectors with acceptable latency |
| Crawl system | Needs full rewrite | Must move to dedicated job queue (BullMQ, Temporal, etc.) |
| Multi-region | Not supported | merchant_id partitioning is in-app, not at DB level |

---

## 4. Market Comparison

| Capability | This System | Algolia AI Search | Vectara | Mendable |
|---|---|---|---|---|
| **Hybrid Search** | Yes (RRF in SQL) | Yes (native) | Yes (native) | No |
| **Reranking** | No | Yes (cross-encoder) | Yes (built-in) | No |
| **Semantic Cache** | No | N/A | No | No |
| **Anti-hallucination** | Yes (fact validation) | N/A | Grounded gen | Basic |
| **Graph expansion** | Yes (1-hop edges) | Faceted nav | No | No |
| **Embedding versioning** | No | Managed | Managed | Managed |
| **P50 Latency** | ~2-3s | <200ms | <500ms | ~1-2s |
| **Index type** | IVFFlat | Proprietary | Proprietary | N/A |

**Unique advantage:** Combined crawl-to-chat pipeline with graph expansion + fact validation. No competitor offers this exact combination.

**Primary gap:** Retrieval quality (no reranking, IVFFlat, fixed thresholds) is below Vectara/Algolia. Latency (3 LLM calls) is the main UX disadvantage.

---

## 5. Risk Matrix

| # | Risk | Severity | Likelihood | File |
|---|---|---|---|---|
| 1 | O(n^2) edge building | **Critical** | High | `record-processor.ts:145-155` |
| 2 | IVFFlat recall degradation | High | Medium | `migrations/0014_records_table.sql` |
| 3 | In-memory rate limiting | High | High | `chat.ts:57` |
| 4 | No embedding versioning | High | Medium | `chunks` + `records` tables |
| 5 | 3 LLM calls/query latency | Medium | Certain | `stream.post.ts` (full pipeline) |
| 6 | No reranking stage | Medium | Certain | `chat.ts:179-248` |
| 7 | Fixed similarity threshold 0.35 | Medium | Medium | `chat.ts:182,198,212,228` |
| 8 | No query caching | Medium | High | N/A (missing) |
| 9 | `match_chunks_by_type` missing probes=10 | Medium | High | `migrations/0013_match_functions_v2.sql` |
| 10 | Heuristic token counting | Low | Medium | `chunker.ts` |
| 11 | Anthropic client per request | Low | Certain | `stream.post.ts:75,157` |
| 12 | Dual retrieval paths (chunks + records) | Low | Low | Architectural |

---

## 6. Prioritized Recommendations

### P0: Pre-Scale Blockers (Before 50+ Merchants)

**R1. Fix O(n^2) edge building** (`record-processor.ts:115-166`)
Replace all-pairs edges with top-K nearest neighbors (K=5-10) or lazy query-time expansion. Current: 50 products in "shoes" = 2,450 edges. After: 50 x 5 = 250 edges.

**R2. Migrate IVFFlat to HNSW** (one SQL migration)
```sql
CREATE INDEX CONCURRENTLY ... USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
```
HNSW: >95% recall, no probes tuning. Trade-off: ~2x memory vs IVFFlat.

**R3. Fix missing `ivfflat.probes=10`** in `match_chunks_by_type`
Currently only `match_chunks` (migration 0007) sets probes. The type-filtered path used for product/brand/support intents likely uses default `probes=1`.

**R4. Replace in-memory rate limiter** (`chat.ts:57`)
Options: Redis (Upstash), Supabase atomic counter, or CF Workers rate limiting.

### P1: Quality Improvements (Before 100+ Merchants)

**R5. Add reranking stage** -- Cohere `rerank-v3` or Jina `reranker-v2` after retrieving top-20, return top-5. Typical precision@5 improvement: 15-30%.

**R6. Per-intent similarity thresholds** -- Replace fixed 0.35 with `{ product: 0.45, brand: 0.35, support: 0.30, general: 0.30 }`.

**R7. Semantic query cache** -- Hash embedding -> cache retrieval + validation results. TTL 5-15min. Eliminates 2/3 LLM calls for repeated queries.

**R8. Add embedding model version column** -- `embedding_model TEXT DEFAULT 'text-embedding-3-small'` on chunks + records.

### P2: Optimizations (Before 500+ Merchants)

**R9. Reduce LLM calls** -- Rule-based intent for common patterns; skip validation when all results have similarity > 0.7; merge intent + validation into one call.

**R10. Parallelize chunks + records retrieval** (`chat.ts:179-248`) -- Independent queries, should use `Promise.all`. Saves ~50-100ms.

**R11. Singleton LLM clients** -- Module-level Anthropic/OpenAI instances instead of per-request.

**R12. Proper tokenizer** -- Replace `words/1.3` in chunker with `js-tiktoken` for accurate chunk sizing across languages.

---

## 7. Cost Model

At 1,000 daily sessions x 5 messages = 5,000 queries/day:

| Component | Per-Query | Monthly |
|-----------|-----------|---------|
| Intent (gpt-4o-mini) | $0.00015 | $22 |
| Embedding (text-embedding-3-small) | $0.00002 | $3 |
| Validation (gpt-4o-mini) | $0.00040 | $60 |
| Response (Claude Sonnet 4) | $0.00300 | $450 |
| **Total** | **$0.0036** | **$535** |

Response generation = 84% of cost. With caching (R7), monthly drops to ~$350-400.

---

## 8. Conclusion

This is competent RAG engineering at MVP scale. The anti-hallucination pipeline and hybrid retrieval are above average for early-stage. The critical path to production readiness is: **R1 (edges) > R2 (HNSW) > R3 (probes fix) > R4 (rate limiting) > R7 (cache) > R5 (reranking)**.

These six changes move the grade from **B- to A-** and position for 100x growth.
