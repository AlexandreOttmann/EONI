# RAG Pipeline

End-to-end flow from merchant URL to AI-powered chat responses.

---

## 1. Crawl

```
Merchant inputs URL in dashboard
  -> POST /api/crawl/start { url }
  -> Server calls Cloudflare /crawl API
  -> Cloudflare renders JS, follows links, returns pages as markdown
  -> Store each page in `pages` table (merchant_id, url, title, markdown)
  -> Update crawl_job status via Supabase Realtime (dashboard shows progress)
```

**Cloudflare /crawl API:**
- Single API call handles JS rendering, pagination, sitemap discovery
- Supports incremental re-crawl via `modifiedSince` parameter
- Returns pages as clean markdown (no HTML tags)
- Rate limited per Cloudflare account

**Incremental re-crawl:**
- Store `crawled_at` on each page
- On re-crawl, pass `modifiedSince` = last crawl timestamp
- Only new/changed pages get re-processed
- Old chunks for changed pages are deleted and re-created

---

## 2. Chunk

```
For each crawled page:
  -> Split markdown into chunks (~500 tokens each)
  -> One chunk = one product/trip/service (prefer semantic boundaries)
  -> Prepend merchant name + source URL to each chunk (for citation)
  -> Store in `chunks` table with metadata jsonb
```

**Chunking strategy:**
- Target: ~500 tokens per chunk
- Prefer splitting at semantic boundaries (headings, product sections)
- Each chunk should be self-contained (includes product name, price, key attributes)
- Metadata extracted into jsonb: `{ price, currency, dates, tags, category, source_url }`
- If a page has one clear product, it becomes one chunk regardless of token count

**Prepend pattern:**
```
[Source: Odysway | https://odysway.com/trips/japan-autumn]
Autumn in Japan — 12 days
Price: 2,490 EUR per person
Dates: Oct 5-16, Oct 19-30, Nov 2-13
...
```

---

## 3. Embed

```
For each chunk:
  -> Call OpenAI text-embedding-3-small API
  -> Returns 1536-dimensional vector
  -> Store vector in chunks.embedding column (pgvector)
```

**Model:** `text-embedding-3-small`
- Dimensions: 1536
- Cost: ~$0.02 per 1M tokens (very cheap)
- Batch embedding: send up to 2048 texts per API call

**pgvector index:**
```sql
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
Rebuild index after bulk inserts (post-crawl).

---

## 4. Search

```
User sends message via widget or dashboard preview
  -> Embed user message with text-embedding-3-small
  -> pgvector cosine similarity search:
       SELECT id, content, metadata, 1 - (embedding <=> $query_embedding) AS score
       FROM chunks
       WHERE merchant_id = $merchant_id
         AND 1 - (embedding <=> $query_embedding) > 0.72
       ORDER BY embedding <=> $query_embedding
       LIMIT 8
  -> Return top 8 chunks with score > 0.72
```

**Critical:** ALWAYS include `WHERE merchant_id = $merchant_id`. Never search across merchants.

**Score threshold:** 0.72 (cosine similarity). Below this, chunks are too dissimilar to be useful. If no chunks pass the threshold, the AI should say "I don't have enough information to answer that."

---

## 5. Prompt Assembly

```
System prompt:
  "You are a helpful assistant for {merchant_name}. Answer questions
   using ONLY the context provided below. If the context does not
   contain the answer, say so honestly. Always cite the source URL
   when referencing specific products or services.

   Merchant: {merchant_name}
   Website: {merchant_domain}"

Context (retrieved chunks):
  [1] {chunk.content} (score: {score})
  [2] {chunk.content} (score: {score})
  ... up to 8 chunks

Conversation history (last 6 turns):
  User: {message_1}
  Assistant: {response_1}
  User: {message_2}
  Assistant: {response_2}
  ... last 6 messages

Current user message:
  {user_message}
```

**Prompt constraints:**
- System prompt is constant per merchant (cached)
- Context window budget: ~4000 tokens for chunks, ~2000 for history, rest for response
- Never include chunks from other merchants in the prompt
- If no relevant chunks found, instruct the model to say it cannot answer

---

## 6. Stream

```
Assembled prompt -> Anthropic Claude Sonnet API (streaming)
  -> Server receives token-by-token
  -> createEventStream() in Nuxt server route
  -> SSE events sent to client:
       event: chunk  / data: {"text": "partial..."}
       event: sources / data: {"chunks": [...]}
       event: done   / data: {}
  -> Client (widget or dashboard) renders tokens as they arrive
  -> On stream end: persist full message to Supabase
```

**Anthropic SDK pattern:**
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: systemPrompt,
  messages: conversationMessages,
})

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    sendSSE('chunk', { text: event.delta.text })
  }
}
```

**Never return a complete response.** Always stream. This is a UX requirement — users see tokens appearing in real time.

---

## Pipeline Summary

```
URL -> Cloudflare /crawl -> markdown pages
  -> chunk (500 tokens, semantic boundaries)
  -> embed (OpenAI text-embedding-3-small, 1536 dims)
  -> store (pgvector + metadata in Supabase)

Query -> embed -> pgvector search (top 8, score >= 0.72, merchant_id)
  -> prompt (system + chunks + history)
  -> Claude Sonnet stream -> SSE -> widget/dashboard
  -> persist conversation
```
