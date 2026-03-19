## Feature: Dashboard API Wiring + useChat Composable

**Phase:** 1.3 / 1.5
**Priority:** P0 (blocker — all dashboard pages are mock data)
**Branch:** feat/dashboard-wiring

### User Story
As a merchant, I want my dashboard pages to show real data from my account so that I can manage my store, view analytics, configure my widget, and chat with my AI assistant.

### Acceptance Criteria

- [ ] `useMerchantConfig` composable exists, shared between settings + widget pages
- [ ] **Settings page** loads merchant name/domain from `GET /api/merchant/config`, saves via `PATCH /api/merchant/config`, email from `useSupabaseUser()`
- [ ] **Widget page** loads widget_config (primary_color, welcome_message, position) + widget_key from `GET /api/merchant/config`, saves via `PATCH /api/merchant/config`
- [ ] **Analytics page** loads stats from `GET /api/merchant/analytics`, displays total_conversations, total_messages, no_answer_rate, top_questions
- [ ] **Overview page (index.vue)** derives stats from `GET /api/crawl/jobs` + `GET /api/merchant/analytics` (no new endpoint). "Recent Conversations" card replaced with "Top Questions"
- [ ] **useChat composable** exists: `sendMessage(text)` streams via POST `/api/chat/stream` + ReadableStream, `loadHistory(sessionId)`, `stopStreaming()`, AbortController cleanup on unmount
- [ ] **Chat page** has message list (scrollable), input bar (pinned bottom), streaming cursor, collapsible sources, auto-scroll on new chunks
- [ ] All mock data and `setTimeout` loaders removed from every dashboard page
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

### Technical Notes

#### New Files to Create
- `app/composables/useMerchantConfig.ts` — `useFetch('/api/merchant/config')` + `updateConfig(payload)` via `$fetch PATCH`, refresh, success toast. Returns `{ merchant, isLoading, error, refresh, updateConfig }`
- `app/composables/useChat.ts` — SSE consumption via `fetch()` + `ReadableStream` (not EventSource — it's a POST). State: `messages`, `isStreaming`, `sources`, `error`, `currentSessionId`. Internal `ensureWidgetKey()` fetches merchant config once for widget_key auth. SSE parser buffers text, splits on `\n\n`, yields `{ event, data }`.
- `app/pages/dashboard/chat.vue` — Full chat UI replacing current stub

#### Files to Edit (replace mock data with real API calls)
- `app/pages/dashboard/settings.vue` — use `useMerchantConfig()`, email from `useSupabaseUser()`
- `app/pages/dashboard/widget.vue` — use `useMerchantConfig()`, widget_key from merchant config
- `app/pages/dashboard/analytics.vue` — `useFetch('/api/merchant/analytics')`, map to stat cards
- `app/pages/dashboard/index.vue` — `useFetch('/api/crawl/jobs')` + `useFetch('/api/merchant/analytics')` in parallel, derive stats, replace "Recent Conversations" with "Top Questions"

#### Key Reference Files
- `app/composables/useCrawl.ts` — composable pattern to follow (ref, $fetch, onUnmounted, toast)
- `app/types/api.ts` — all types: ChatStreamRequest, ChatChunkEvent, ChatSourcesEvent, ChatDoneEvent, ChatHistoryResponse, MerchantConfigResponse, AnalyticsResponse, Message, Conversation
- `server/api/chat/stream.post.ts` — SSE event format: `sources` (chunks[]), `chunk` ({text}), `done` ({message_id}), `error` ({message})
- `server/api/merchant/config.get.ts` — response: `{ merchant }` with widget_config containing widget_key, primary_color, welcome_message, position
- `server/api/merchant/config.patch.ts` — accepts `{ name?, domain?, widget_config?: { primary_color?, welcome_message?, position? } }`
- `server/api/merchant/analytics.get.ts` — response: `{ total_conversations, total_messages, top_questions[], no_answer_rate }`
- `app/stores/auth.ts` — merchant state, user email

#### SSE Details for useChat
The stream endpoint (`POST /api/chat/stream`) requires `{ message, session_id, widget_key }` in the body. Auth is via widget_key (not JWT). The composable must:
1. Fetch widget_key once from `/api/merchant/config` (cache it)
2. Generate session_id via `crypto.randomUUID()` for new conversations
3. Use `fetch()` + `response.body.getReader()` + `TextDecoderStream` to read SSE
4. Buffer incoming text, split on `\n\n`, parse `event:` and `data:` lines
5. On `sources` event → set sources ref
6. On `chunk` event → append text to last assistant message content
7. On `done` event → update message id, set isStreaming false
8. On `error` event → toast error, set isStreaming false

#### Overview Page Stats Derivation (no new endpoint)
- "Pages crawled" = sum `pages_crawled` from completed crawl jobs
- "Chunks indexed" = sum `chunks_created` from completed crawl jobs
- "Conversations" = `analytics.total_conversations`
- "Status" = "Live" if any crawl completed, else "Setup"
- Remove fake deltas (no historical comparison data)

### Implementation Order
1. `useMerchantConfig.ts` — shared dependency
2. Wire `settings.vue` — simplest, validates composable
3. Wire `widget.vue` — same pattern
4. Wire `analytics.vue`
5. Wire `index.vue` — most derivation logic
6. `useChat.ts`
7. `chat.vue`

### Required Context
- `.claude/context/STATUS.md`
- `.claude/context/api-contracts.md`
- `.claude/context/data-models.md`
- `app/types/api.ts`
- `app/composables/useCrawl.ts` (pattern reference)

### Verification
1. `cd nuxt-app && pnpm typecheck` — no errors
2. `cd nuxt-app && pnpm lint` — clean
3. Manual test each page with dev server running
