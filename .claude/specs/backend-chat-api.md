## Feature: Chat API — Bearer Auth + Non-Streaming Endpoint

**Phase:** 1.3
**Priority:** P1 (must-have — enables merchants to build custom chat integrations)
**Branch:** feat/chat-api

### User Story
As a merchant, I want a developer-friendly Chat API with standard Bearer token auth and both streaming and non-streaming modes, so I can build my own custom chat UI instead of using the drop-in widget.

### Acceptance Criteria

- [ ] Shared chat utilities extracted into `server/utils/chat.ts` (merchant resolution, rate limiting, RAG context building)
- [ ] `POST /api/chat/stream` accepts `Authorization: Bearer <widget_key>` header (falls back to body `widget_key` for backward compat)
- [ ] `POST /api/chat/message` exists — non-streaming JSON endpoint with same auth, same RAG pipeline, single JSON response
- [ ] Both endpoints share rate limiting (20 req/min per widget_key)
- [ ] Both endpoints share merchant resolution + multi-tenancy enforcement
- [ ] New types added to `app/types/api.ts`: `ChatMessageRequest`, `ChatMessageResponse`
- [ ] `session_id` is optional on `/api/chat/message` — auto-generated if omitted
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

### Technical Notes

#### 1. Extract shared logic: `server/utils/chat.ts` (create)

Refactor inline logic from `server/api/chat/stream.post.ts` into reusable functions:

```typescript
// Resolve widget_key from Bearer header or body, return merchant
resolveMerchant(event: H3Event, bodyWidgetKey?: string): Promise<{ merchantId: string; widgetKey: string }>
// Check: Authorization: Bearer <uuid> header first, then bodyWidgetKey fallback
// Query merchants table by widget_config->>widget_key
// Throw createError(401) if no match

// Existing in-memory rate limiter, extracted
rateLimitByKey(widgetKey: string, limit?: number, windowMs?: number): void
// Throws createError(429) with Retry-After header if exceeded

// Full RAG context assembly
buildChatContext(supabase: SupabaseClient, merchantId: string, message: string, sessionId: string): Promise<{
  conversation: { id: string }
  history: Array<{ role: string; content: string }>
  chunks: Array<{ id: string; content: string; similarity: number }>
  prompt: { system: string; messages: Anthropic.MessageParam[] }
}>
// 1. Lookup/create conversation for session_id + merchant_id
// 2. Fetch last 6 messages
// 3. Embed user message via embedder.ts
// 4. pgvector search via match_chunks RPC (threshold 0.72, top 8)
// 5. Build prompt via prompt.ts
```

#### 2. Refactor `server/api/chat/stream.post.ts` (edit)

- Replace inline merchant resolution with `resolveMerchant(event, body.widget_key)`
- Replace inline rate limiter with `rateLimitByKey(widgetKey)`
- Replace inline RAG setup with `buildChatContext(...)`
- Keep SSE streaming logic (createEventStream, Claude stream, persist messages) in this file
- Make `widget_key` optional in Zod body schema (can come from header instead)

#### 3. Create `server/api/chat/message.post.ts` (create)

Non-streaming endpoint:

```typescript
// Zod schema
const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),  // auto-generate if omitted
  widget_key: z.string().uuid().optional(),  // optional if Bearer header used
})

// Flow:
// 1. resolveMerchant(event, body.widget_key)
// 2. rateLimitByKey(widgetKey)
// 3. session_id = body.session_id ?? crypto.randomUUID()
// 4. buildChatContext(supabase, merchantId, message, sessionId)
// 5. Call Claude Sonnet with stream: false, max_tokens: 1024
// 6. Persist user + assistant messages to DB
// 7. Return JSON response
```

Response shape:
```json
{
  "text": "The full assistant response",
  "sources": [{ "id": "uuid", "content": "chunk text", "similarity": 0.89 }],
  "message_id": "uuid",
  "session_id": "uuid",
  "conversation_id": "uuid"
}
```

#### 4. Add types to `app/types/api.ts` (edit)

```typescript
interface ChatMessageRequest {
  message: string
  session_id?: string
  widget_key?: string
}

interface ChatMessageResponse {
  text: string
  sources: Array<{ id: string; content: string; similarity: number }>
  message_id: string
  session_id: string
  conversation_id: string
}
```

### Key Reference Files
- `server/api/chat/stream.post.ts` — current implementation to refactor (all inline logic)
- `server/utils/embedder.ts` — embedding generation (reused by buildChatContext)
- `server/utils/prompt.ts` — prompt assembly (reused by buildChatContext)
- `server/utils/crawl-worker.ts` — example of extracted server utils pattern
- `app/types/api.ts` — existing chat types to extend

### Implementation Order
1. Create `server/utils/chat.ts` with the three extracted functions
2. Refactor `server/api/chat/stream.post.ts` to use the new utils
3. Create `server/api/chat/message.post.ts`
4. Add types to `app/types/api.ts`

### Required Context
- `.claude/context/STATUS.md`
- `.claude/context/api-contracts.md`
- `.claude/context/data-models.md`
- `.claude/context/rag-pipeline.md`

### Verification
1. `cd nuxt-app && pnpm typecheck` — no errors
2. `cd nuxt-app && pnpm lint` — clean
3. Test Bearer auth streaming:
   ```bash
   curl -N -H "Authorization: Bearer <widget_key>" \
     -H "Content-Type: application/json" \
     -d '{"message":"hello","session_id":"<uuid>"}' \
     http://localhost:3000/api/chat/stream
   ```
4. Test non-streaming:
   ```bash
   curl -H "Authorization: Bearer <widget_key>" \
     -H "Content-Type: application/json" \
     -d '{"message":"hello"}' \
     http://localhost:3000/api/chat/message
   ```
5. Test backward compat (widget_key in body, no header) still works on `/api/chat/stream`
