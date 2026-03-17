# Ecommerce AI SaaS — Build Status

Last updated: 2026-03-17

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
| Auth flow (email + Google OAuth via Supabase) | main | ✅ server routes done | backend -> frontend |
| Dashboard layout (sidebar, header, auth guard) | main | ✅ implemented | ui-ux -> frontend |
| Design system tokens (Tailwind v4 @theme, Nuxt UI app.config) | main | ✅ spec done | ui-ux |
| Auth UI (login, signup, auth layout) | main | ✅ implemented | frontend |

### 1.2 Crawl Pipeline

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| POST /api/crawl/start (Cloudflare /crawl trigger) | — | ⬜ | backend |
| Crawl status polling + Supabase Realtime subscription | — | ⬜ | backend |
| Content chunking (500 tokens, 1 chunk = 1 product) | — | ⬜ | backend |
| OpenAI embedding generation + pgvector storage | — | ⬜ | backend |
| Dashboard crawl page (progress UI) | — | ⬜ | ui-ux -> frontend |

### 1.3 RAG Chat

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| POST /api/chat/stream (SSE endpoint) | — | ⬜ | backend |
| pgvector similarity search (top 8, score >= 0.72, merchant_id filter) | — | ⬜ | backend |
| Prompt assembly (system + merchant context + chunks + history) | — | ⬜ | backend |
| Claude Sonnet streaming via Anthropic SDK | — | ⬜ | backend |
| Conversation persistence to Supabase | — | ⬜ | backend |
| useChat composable (SSE client) | — | ⬜ | frontend |

### 1.4 Widget

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Widget Vite build setup (standalone, <=30kb) | — | ⬜ | frontend |
| Shadow DOM container | — | ⬜ | frontend |
| SSE chat in widget | — | ⬜ | frontend |
| Widget config dashboard page (color, message, position) | main | ✅ UI shell (mock data) | frontend |
| Widget `<script>` tag generation | — | ⬜ | backend |
| GDPR cookie consent in widget | — | ⬜ | security |

### 1.5 Dashboard Pages

| Task | Branch | Status | Agent |
|------|--------|--------|-------|
| Onboarding flow (URL input -> crawl -> go live) | main | ✅ UI shell (mock data) | frontend |
| Analytics page (conversations, top questions, no-answer rate) | main | ✅ UI shell (mock data) | frontend |
| Settings page (merchant profile, API keys) | main | ✅ UI shell (mock data) | frontend |

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

Phase 1a Marketing Surface complete. Phase 1.1 Foundation frontend (auth UI + dashboard shell) complete. Backend crawl/chat endpoints next.

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
- `nuxt-app/server/api/auth/login.post.ts` — email+password sign in
- `nuxt-app/server/api/auth/signup.post.ts` — new merchant registration (auth user + merchant row)
- `nuxt-app/server/api/auth/callback.get.ts` — OAuth code exchange → redirect /dashboard
- `nuxt-app/server/api/auth/me.get.ts` — current merchant profile
- `nuxt-app/server/api/auth/logout.post.ts` — sign out
- `nuxt-app/app/types/api.ts` — all API types (Merchant, CrawlJob, Page, Chunk, Conversation, Message, request/response types)
- `nuxt-app/app/types/database.types.ts` — Supabase DB type stub (replace with `supabase gen types` after project creation)

---

## Up Next

1. **security-auditor** -> Review RLS policies in `0002_rls_policies.sql`
2. ~~**ui-ux-designer** -> Design dashboard layout + design system tokens~~ ✅ done — see `.claude/design-specs/dashboard-layout.md`
3. ~~**frontend-developer** -> Implement auth UI + dashboard shell~~ ✅ done — all 14 files built, build passes
4. **backend-developer** -> POST /api/crawl/start + crawl status endpoints (Phase 1.2)
5. **backend-developer** -> POST /api/chat/stream SSE endpoint (Phase 1.3)
6. **frontend-developer** -> Wire dashboard pages to real API endpoints once backend is ready

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
