# Ecommerce AI SaaS — Build Status

Last updated: 2026-03-19

> **New agent?** Read this file first. Then read the files listed under
> "Required Context" for your specific task. Do NOT redo completed work.
> Start from "Current Focus" or "Up Next".

---

## Overall Progress

```
Phase 1  — MVP Core            🔄 IN PROGRESS
Phase 1a — Marketing Surface   ✅ COMPLETE
Phase 2  — AI Visibility       ⬜ NOT STARTED
Phase 3  — Automation + Scale  ⬜ NOT STARTED
```

---

## Phase 1 — MVP Core

### 1.1 Foundation  

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Supabase schema (merchants, pages, chunks, conversations, messages, crawl_jobs) | main | ✅ | backend |
| RLS policies (merchant_id isolation on all tables) | main | ✅ pending security review | backend -> security |
| Auth flow (email + Google OAuth via Supabase) | main | ✅ fully working (client-side login, JWT sub fix) | backend -> frontend |
| Dashboard layout (sidebar, header, auth guard) | main | ✅ implemented | ui-ux -> frontend |
| Design system tokens (Tailwind v4 @theme, Nuxt UI app.config) | main | ✅ spec done | ui-ux |
| Auth UI (login, signup, auth layout) | main | ✅ implemented | frontend |

### 1.2 Crawl Pipeline

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| POST /api/crawl/start (Cloudflare /crawl trigger) | main | ✅ | backend |
| Crawl status polling + Supabase Realtime subscription | main | ✅ GET /api/crawl/status/[jobId] + GET /api/crawl/jobs | backend |
| Content chunking (500 tokens, 1 chunk = 1 product) | main | ✅ server/utils/chunker.ts | backend |
| OpenAI embedding generation + pgvector storage | main | ✅ server/utils/embedder.ts | backend |
| Dashboard crawl page (progress UI) | main | ✅ wired to real API (useCrawl composable) | frontend |

### 1.3 RAG Chat

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| POST /api/chat/stream (SSE endpoint) | main | ✅ | backend |
| pgvector similarity search (top 8, score >= 0.72, merchant_id filter) | main | ✅ via match_chunks RPC | backend |
| Prompt assembly (system + merchant context + chunks + history) | main | ✅ server/utils/prompt.ts | backend |
| Claude Sonnet streaming via Anthropic SDK | main | ✅ | backend |
| Conversation persistence to Supabase | main | ✅ | backend |
| useChat composable (SSE client) | feat/dashboard-wiring | ✅ | frontend |

### 1.4 Widget

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Widget Vite build setup (standalone, <=30kb) | — | ⬜ | frontend |
| Shadow DOM container | — | ⬜ | frontend |
| SSE chat in widget | — | ⬜ | frontend |
| Widget config dashboard page (color, message, position) | feat/dashboard-wiring | ✅ wired to real API | frontend |
| Widget `<script>` tag generation | — | ⬜ | backend |
| GDPR cookie consent in widget | — | ⬜ | security |

### 1.5 Dashboard Pages

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Onboarding flow (URL input -> crawl -> go live) | main | ✅ wired to real API | frontend |
| Analytics page (conversations, top questions, no-answer rate) | feat/dashboard-wiring | ✅ wired to real API | frontend |
| Settings page (merchant profile, API keys) | feat/dashboard-wiring | ✅ wired to real API | frontend |
| Chat preview page (SSE streaming, sources panel) | feat/dashboard-wiring | ✅ | frontend |
| Dashboard overview wired to real data | feat/dashboard-wiring | ✅ | frontend |

---

## Phase 1a — Marketing Surface

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Marketing layout (Lenis, GSAP, CustomCursor, NoiseOverlay) | main | ✅ | ui-ux -> frontend |
| Hero section (word reveal, gradient, parallax) | main | ✅ | ui-ux -> frontend |
| Feature bento grid (stagger entrance) | main | ✅ | ui-ux -> frontend |
| Pricing section | main | ✅ | ui-ux -> frontend |
| Navigation (glass blur, scroll-triggered border) | main | ✅ | ui-ux -> frontend |
| LogoCloud, HowItWorks, ProductShowcase sections | main | ✅ | frontend |
| Testimonials, CTA, Footer sections | main | ✅ | frontend |
| Homepage page (index.vue with marketing layout) | main | ✅ | frontend |

---

## Phase 2 — AI Visibility (months 4-6)

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| SSG catalog pages (/c/[slug]/) | — | ⬜ | backend -> frontend |
| Schema.org JSON-LD generation | — | ⬜ | backend |
| llms.txt + sitemap generation | — | ⬜ | backend |
| MCP endpoint (/api/mcp/[slug]/search) | — | ⬜ | backend |

---

## Phase 3 — Automation + Scale (months 7-12)

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Webhook system (lead_detected, booking_intent, crawl_completed) | — | ⬜ | backend |
| Webhook config dashboard | — | ⬜ | ui-ux -> frontend |
| Multi-user merchant accounts | — | ⬜ | backend -> security |

---

## Current Focus

Phase 1a Marketing Surface complete. Phase 1.1 Foundation complete. Phase 1.2 Crawl Pipeline backend complete. Phase 1.3 RAG Chat backend complete. Anti-hallucination RAG refactor Part A (structured extraction) and Part B (validation pipeline) complete on `feat/anti-hallucination-rag`. Next: security-auditor reviews products table RLS + match_products permissions + validator input sanitization; then playwright-tester E2E coverage.

### What exists (Phase 1a — Marketing Surface)

- `nuxt-app/plugins/gsap.client.ts` — GSAP + ScrollTrigger registration
- `nuxt-app/plugins/lenis.client.ts` — Lenis smooth scroll + GSAP ticker
- `nuxt-app/app/composables/useGsap.ts` — GSAP accessor with cleanup
- `nuxt-app/app/composables/useLenis.ts` — route-aware Lenis start/stop
- `nuxt-app/app/composables/useTextReveal.ts` — GSAP word-by-word heading reveal
- `nuxt-app/app/composables/useReveal.ts` — GSAP fade-up section reveal
- `nuxt-app/app/layouts/marketing.vue` — Marketing layout (Lenis, CustomCursor, NoiseOverlay, AnimatePresence)
- `nuxt-app/app/layouts/default.vue` — Default layout (starter template preserved)
- `nuxt-app/app/components/marketing/NoiseOverlay.vue` — SVG fractal noise overlay
- `nuxt-app/app/components/marketing/CustomCursor.vue` — Spring-following cursor dot
- `nuxt-app/app/components/marketing/MagneticButton.vue` — Magnetic CTA with spring physics
- `nuxt-app/app/components/marketing/MarketingNav.vue` — Fixed glass nav with GSAP scroll border
- `nuxt-app/app/components/marketing/HeroSection.vue` — Hero with text reveal + parallax mockup
- `nuxt-app/app/components/marketing/LogoCloud.vue` — Infinite-scroll logo cloud
- `nuxt-app/app/components/marketing/HowItWorks.vue` — 3-step flow with animated connector
- `nuxt-app/app/components/marketing/FeatureBento.vue` — Asymmetric bento grid with mouse-follow glow
- `nuxt-app/app/components/marketing/ProductShowcase.vue` — Pinned horizontal scroll showcase
- `nuxt-app/app/components/marketing/Testimonials.vue` — Glass blockquote cards
- `nuxt-app/app/components/marketing/PricingSection.vue` — 3-tier pricing with billing toggle
- `nuxt-app/app/components/marketing/CTASection.vue` — Final conversion CTA
- `nuxt-app/app/components/marketing/MarketingFooter.vue` — 4-column footer
- `nuxt-app/app/pages/index.vue` — Homepage composing all sections
- `nuxt-app/app/app.vue` — Restructured to UApp > NuxtLayout > NuxtPage
- `nuxt-app/app/assets/css/main.css` — Added scrollbar-hide, logo-scroll, reduced-motion queries

### What exists (Phase 1.1 frontend — dashboard + auth)

- `nuxt-app/app/composables/useSidebar.ts` — mobile sidebar open/close state (shared ref)
- `nuxt-app/app/composables/useCountUp.ts` — animated number count-up with reduced-motion fallback
- `nuxt-app/app/layouts/dashboard.vue` — sidebar + header + slot with page transition (AnimatePresence)
- `nuxt-app/app/layouts/auth.vue` — centered card with noise overlay + violet/cyan dual glow
- `nuxt-app/app/components/dashboard/Sidebar.vue` — fixed sidebar with staggered nav, active indicator pill, glass merchant footer
- `nuxt-app/app/components/dashboard/Header.vue` — sticky glass header with page title, New Crawl CTA, color mode toggle
- `nuxt-app/app/components/dashboard/CrawlProgressCard.vue` — glass progress card with animated spinner + spring progress bar
- `nuxt-app/app/pages/dashboard/index.vue` — Overview with stat cards (count-up, sparklines, mouse-follow glow), recent tables, empty state
- `nuxt-app/app/pages/dashboard/crawl.vue` — URL input, active crawl card, crawl history table
- `nuxt-app/app/pages/dashboard/widget.vue` — widget config form, live preview mockup, install snippet with copy
- `nuxt-app/app/pages/dashboard/analytics.vue` — stat cards, top questions table, unanswered questions table
- `nuxt-app/app/pages/dashboard/settings.vue` — profile form, account section, danger zone with delete confirmation modal
- `nuxt-app/app/pages/auth/login.vue` — email/password form, Google OAuth, show/hide password
- `nuxt-app/app/pages/auth/signup.vue` — registration form with business name, email, password, optional domain

### What exists (Phase 1.1 backend)

- `nuxt-app/supabase/migrations/0001_initial_schema.sql` — all 7 tables + indexes + updated_at trigger
- `nuxt-app/supabase/migrations/0002_rls_policies.sql` — RLS enabled + SELECT/INSERT/UPDATE/DELETE policies on all tables
- `nuxt-app/supabase/migrations/0003_match_chunks_function.sql` — pgvector cosine similarity RPC
- `nuxt-app/server/api/auth/login.post.ts` — email+password sign in (kept for reference; login now done client-side)
- `nuxt-app/server/api/auth/signup.post.ts` — new merchant registration (auth user + merchant row)
- `nuxt-app/server/api/auth/callback.get.ts` — OAuth code exchange → redirect /dashboard
- `nuxt-app/server/api/auth/me.get.ts` — current merchant profile (auto-provisions merchant row on first login)
- `nuxt-app/server/api/auth/logout.post.ts` — sign out (kept; logout now done client-side via useSupabaseClient)
- `nuxt-app/app/types/api.ts` — all API types (Merchant, CrawlJob, Page, Chunk, Conversation, Message, request/response types)
- `nuxt-app/app/types/database.types.ts` — Supabase DB type stub (replace with `supabase gen types` after project creation)

### What exists (Phase 1.1 frontend — Pinia store + middleware)

- `nuxt-app/app/stores/auth.ts` — Pinia auth store (useAuthStore): merchant state, fetchMerchant, logout, displayName, avatarUrl
- `nuxt-app/app/middleware/auth.ts` — route middleware protecting all /dashboard/* pages

### Auth architecture notes (@nuxtjs/supabase v2)

- `serverSupabaseUser(event)` returns `JwtPayload` (not `User`) — user UUID is `user.sub`, not `user.id`
- Login must be done client-side via `useSupabaseClient().auth.signInWithPassword()` for session to be managed by the module
- Logout must be done client-side via `useSupabaseClient().auth.signOut()` to flush reactive `useSupabaseUser()` state

### Security audit (Phase 1.2 + 1.3)

✅ Security audit complete — S1 rate limiting, S2 env refactor, S3 logging fixed
✅ Crawl endpoint API contract audit complete — all three routes verified (start, jobs, status). UUID validation bug fixed in status/[jobId].get.ts (safeParse + createError 400). Crawl API endpoints are frontend-ready.

### What exists (Phase 1.2 frontend — Crawl wiring)

- `nuxt-app/app/composables/useCrawl.ts` — `useCrawl()` composable: polls `GET /api/crawl/status/:jobId` every 3s, loads history from `GET /api/crawl/jobs`, triggers `POST /api/crawl/start`; auto-clears polling on unmount
- `nuxt-app/app/pages/dashboard/crawl.vue` — wired to real API via `useCrawl()`; removed all mock data; `loadHistory` called on mount to resume any in-progress job

### What exists (Phase 1.2 backend — Crawl restart recovery)

- `nuxt-app/supabase/migrations/0006_cf_job_id.sql` — adds `cf_job_id text` column to `crawl_jobs`
- `nuxt-app/app/types/database.types.ts` — `crawl_jobs` Row/Insert/Update updated with `cf_job_id`
- `nuxt-app/server/utils/crawl-worker.ts` — exports `resumeFromCfJob` (polls CF until complete) and `processPages` (idempotent page + chunk + embedding insert); used by both start route and recovery plugin
- `nuxt-app/server/api/crawl/start.post.ts` — refactored `processJob()` to persist `cf_job_id` before polling, delegates to `resumeFromCfJob`; stale-job expiry block removed (handled by plugin)
- `nuxt-app/server/plugins/crawl-recovery.ts` — Nitro plugin: on server start, resumes recoverable jobs (running + cf_job_id set) and marks unrecoverable jobs failed (running + no cf_job_id)

### What exists (Anti-hallucination RAG refactor — Part A: Structured extraction at crawl time)

- `nuxt-app/supabase/migrations/0008_products_table.sql` — `products` table with merchant_id, page_id, crawl_job_id, name, description, price, currency, availability, sku, category, image_url, source_url, extra_data, extraction_confidence, missing_fields, embedding (vector 1536); ivfflat index; RLS policies; adds `products_extracted` column to `crawl_jobs`
- `nuxt-app/supabase/migrations/0009_match_products_function.sql` — `match_products` pgvector cosine similarity RPC, null-check guard, REVOKE from PUBLIC/anon/authenticated, GRANT to service_role
- `nuxt-app/server/utils/extraction-prompts.ts` — `EXTRACTION_PROMPT` string and `EXTRACTION_SCHEMA` JSON schema for Cloudflare `jsonOptions`
- `nuxt-app/server/utils/crawl-worker.ts` — updated: `CfRecord` now uses `markdown?/json?` instead of `html`; removed `htmlToText()`; `CfPage` extended with `items: Array<Record<string, unknown>>`; `processPages` adds product extraction loop (confidence scoring, missing-fields tracking, embedding + insert, `products_extracted` counter increment)
- `nuxt-app/server/api/crawl/start.post.ts` — updated: CF request body now sends `formats: ["markdown","json"]`, `rejectResourceTypes`, and `jsonOptions` with extraction prompt + schema
- `nuxt-app/app/types/api.ts` — added `Product` interface; `CrawlJob` now includes `products_extracted: number`
- `nuxt-app/app/types/database.types.ts` — added `products` Row/Insert/Update; `crawl_jobs` updated with `products_extracted`; `match_products` added to Functions

### What exists (Anti-hallucination RAG refactor -- Part B: Validation pipeline at query time)

- `nuxt-app/server/utils/chat.ts` -- refactored `buildChatContext()`: products-first retrieval (top 3, threshold 0.65 via `match_products` RPC), chunks-only fallback (top 5, threshold 0.65); returns `{ conversationId, products, chunks, queryEmbedding, history }` (no longer builds prompt); exports `ProductResult`, `ChunkResult`, `HistoryMessage`, `ChatContext` types
- `nuxt-app/server/utils/rag-validator.ts` -- NEW: `validateAndExtract()` function: short-circuits on empty context, uses Claude Haiku for fact-checking + answerability assessment, Zod-parsed response, populates `suggestedProducts` for soft fallback; exports `ValidationResult` type
- `nuxt-app/server/utils/prompt.ts` -- added `buildFactBasedPrompt()`: fact-based prompt with verified facts + structured product data, "explain WHY it matches" instruction, source citation rules; original `buildPrompt()` preserved for chunk-only fallback
- `nuxt-app/server/api/chat/stream.post.ts` -- rewired to 2-step pipeline: buildChatContext -> validateAndExtract -> branch (not answerable: soft fallback with suggested products, no Sonnet call; answerable: buildFactBasedPrompt -> Sonnet stream); structured consola logging per query; confidence_score from validation persisted on messages
- `nuxt-app/server/api/chat/message.post.ts` -- same 2-step pipeline, non-streaming variant; returns `products` in response alongside `sources`
- `nuxt-app/app/types/api.ts` -- added `ChatProductResult` interface; `ChatMessageResponse` now includes `products: ChatProductResult[]`; `ChatSourcesEvent` now includes optional `products` field

Branch: `feat/anti-hallucination-rag` (Part A+B complete)

### What exists (Phase 1.2 + 1.3 backend — Crawl Pipeline + RAG Chat)

- `nuxt-app/supabase/migrations/0005_conversations_unique_constraint.sql` — UNIQUE(merchant_id, session_id) on conversations
- `nuxt-app/server/utils/chunker.ts` — markdown → ~500-token RawChunk[] with metadata extraction
- `nuxt-app/server/utils/embedder.ts` — OpenAI text-embedding-3-small, batched up to 2048 texts
- `nuxt-app/server/utils/prompt.ts` — system prompt + merchant context + chunk context + history assembly
- `nuxt-app/server/api/crawl/start.post.ts` — trigger Cloudflare crawl, fire-and-forget processJob(), returns job_id immediately
- `nuxt-app/server/api/crawl/jobs.get.ts` — list last 20 crawl jobs for merchant
- `nuxt-app/server/api/crawl/status/[jobId].get.ts` — poll single job status
- `nuxt-app/server/api/merchant/config.get.ts` — get merchant profile, auto-generates widget_key if missing
- `nuxt-app/server/api/merchant/config.patch.ts` — update name/domain/widget_config, preserves widget_key
- `nuxt-app/server/api/merchant/analytics.get.ts` — conversation + message counts, top questions, no-answer rate
- `nuxt-app/server/utils/chat.ts` — shared chat utils: `rateLimitByKey`, `resolveMerchant`, `buildChatContext`
- `nuxt-app/server/api/chat/stream.post.ts` — SSE: widget_key auth (header or body) → embed → pgvector search → Claude Sonnet stream → persist; refactored to use shared utils
- `nuxt-app/server/api/chat/message.post.ts` — non-streaming JSON endpoint: same auth/RAG pipeline, returns `{ text, sources, message_id, session_id, conversation_id }`
- `nuxt-app/server/api/chat/history/[sessionId].get.ts` — fetch conversation + messages for dashboard
- `nuxt-app/app/types/api.ts` — added ChatHistoryResponse, ChatMessageRequest, ChatMessageResponse

### What exists (Phase 1.3 + 1.5 frontend — Dashboard wiring)

- `nuxt-app/app/composables/useMerchantConfig.ts` — `useMerchantConfig()` composable: `useFetch('/api/merchant/config')` + `updateConfig()` via `$fetch PATCH`, instant UI update, toast notifications
- `nuxt-app/app/composables/useChat.ts` — `useChat()` composable: POST-based SSE via `fetch()` + `ReadableStream`, SSE parser, AbortController cleanup, sources tracking
- `nuxt-app/app/pages/dashboard/chat.vue` — Chat preview page: message list, streaming cursor, input bar, collapsible sources sidebar, auto-scroll
- `nuxt-app/app/pages/dashboard/settings.vue` — wired to `useMerchantConfig()` + `useSupabaseUser()`, all mock data removed
- `nuxt-app/app/pages/dashboard/widget.vue` — wired to `useMerchantConfig()`, real widget_key, all mock data removed
- `nuxt-app/app/pages/dashboard/analytics.vue` — wired to `useFetch('/api/merchant/analytics')`, all mock data removed
- `nuxt-app/app/pages/dashboard/index.vue` — wired to `useMerchantConfig()` + `useCrawl()` + analytics API, stats derived from real data, "Top Questions" replaces "Recent Conversations"

---

## Up Next

1. **security-auditor** -> Review RLS policies in `0002_rls_policies.sql`
2. ~~**ui-ux-designer** -> Design dashboard layout + design system tokens~~ ✅ done — see `.claude/design-specs/dashboard-layout.md`
3. ~~**frontend-developer** -> Implement auth UI + dashboard shell~~ ✅ done — all 14 files built, build passes
4. ~~**backend-developer** -> POST /api/crawl/start + crawl status endpoints (Phase 1.2)~~ ✅ done
5. ~~**backend-developer** -> POST /api/chat/stream SSE endpoint (Phase 1.3)~~ ✅ done
6. ~~**frontend-developer** -> Wire crawl page to real API endpoints~~ ✅ done — `useCrawl.ts` composable + `crawl.vue` wired
7. ~~**frontend-developer** -> Wire remaining dashboard pages to real API endpoints (chat, merchant config, analytics)~~ ✅ done — all pages wired, useChat + useMerchantConfig composables, chat.vue page

---

## Key Decisions Made

- Nuxt 4 with `app/` directory layout — all code inside `nuxt-app/`
- Nuxt UI v3 (not shadcn-vue) — Reka UI primitives, `U`-prefix auto-imports
- Tailwind CSS v4 — CSS-first config via `@theme`, not `tailwind.config.ts`
- Motion for Vue (`motion-v`) — spring physics, auto-imported via nuxt module
- GSAP + Lenis — marketing pages only, never in dashboard
- `merchant_id` on every table, Supabase RLS enforces isolation
- pgvector in Supabase — no separate vector DB at MVP
- Cloudflare /crawl — no Firecrawl or Apify
- Claude Sonnet for LLM inference, OpenAI text-embedding-3-small for embeddings
- Widget is standalone Vite bundle with Shadow DOM, <=30kb gzipped
- Conventional commits enforced

---

## Active Branches

| Branch | State | Agent |
|--------|-------|-------|
| main | stable | — |
| feat/dashboard-wiring | ready for review | frontend |
| feat/anti-hallucination-rag | Part A+B complete | backend |

---

## Required Context by Task Area

| If you're working on... | Read these first |
|--------------------------|-----------------|
| Database / schema | `data-models.md` |
| API routes | `api-contracts.md`, `data-models.md` |
| Crawl pipeline | `rag-pipeline.md` |
| Chat / RAG | `rag-pipeline.md`, `data-models.md` |
| Widget | `PROJECT.md` (widget architecture section) |
| Auth | `data-models.md` (merchants table) |
| Marketing pages | `.claude/design-specs/` (when specs exist) |
| Dashboard UI | `.claude/design-specs/` (when specs exist) |
| Security review | All context files |
