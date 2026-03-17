# Ecommerce AI SaaS

SaaS that turns any website into an AI-discoverable, agent-powered storefront.
Merchants get: site crawling, RAG chat widget, LLM-optimized catalog pages, MCP endpoint.

**Before any task:** Read `.claude/context/STATUS.md` — it tells you what's done and what to build next.

---

## Project Structure

All application code lives in `nuxt-app/` (not the repo root).

```
nuxt-app/
├── app/                   Vue pages, components, composables, stores
│   ├── components/        Auto-imported, organized by surface
│   ├── composables/       useChat, useCrawl, useMerchant, etc.
│   ├── pages/             File-based routing
│   ├── layouts/           default (dashboard), auth, marketing, catalog
│   └── stores/            Pinia stores (auth, merchant, conversation)
├── server/
│   └── api/               Nuxt server routes (the entire API layer)
├── supabase/
│   └── migrations/        SQL migrations + RLS policies
├── widget/                Standalone Vite build (Shadow DOM, <=30kb)
└── tests/e2e/             Playwright tests
```

---

## Commands

```bash
cd nuxt-app && pnpm dev          # Dev server
cd nuxt-app && pnpm typecheck    # Type check
cd nuxt-app && pnpm lint         # ESLint
cd nuxt-app && pnpm test:e2e     # Playwright E2E
cd nuxt-app && pnpm build        # Build
```

---

## Code Rules (Apply Always)

- **TypeScript strict** — no `any`, all props/emits/returns typed
- **`<script setup lang="ts">`** — always Composition API, never Options API
- **Nuxt UI v3** — `U`-prefix components (`UButton`, `UCard`, `UModal`, `UTable`). Not shadcn-vue.
- **Tailwind v4** — CSS-first config via `@theme` in `assets/css/main.css`. Not tailwind.config.ts.
- **Zod** — validate all API inputs and env vars
- **VeeValidate + Zod** — all forms
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **No `console.log`** — use structured logging
- **No `v-html`** — sanitize with DOMPurify if unavoidable
- **Never expose service role keys** — server routes only
- **`merchant_id` on every query** — never leak data across merchants

## Multi-Tenancy Rule

Every database query, every pgvector search, every API response MUST filter by `merchant_id`.
Supabase RLS enforces this at the DB level. Server routes use the service role key and
must add the merchant_id filter explicitly. Never trust the client to send merchant_id.

## Streaming Rule

All chat responses stream via SSE using `createEventStream()`. Never return a complete
chat response in a single HTTP response.

---

## Agent Team

| Agent | Scope |
|-------|-------|
| product-manager | Specs, roadmap, acceptance criteria, status tracking |
| frontend-developer | Vue/Nuxt pages, components, composables, Pinia |
| backend-developer | API routes, Supabase, RAG pipeline, crawl |
| ui-ux-designer | Design system, Tailwind tokens, GSAP, Motion/Vue |
| security-auditor | RLS, auth, GDPR, OWASP, a11y |
| playwright-tester | E2E tests, fixtures, CI |

**Coordination sequence:** product-manager specs first -> ui-ux-designer designs -> backend-developer builds API -> frontend-developer builds UI -> security-auditor reviews -> playwright-tester verifies.

---

## Deeper Context (Read On-Demand)

| Document | Path | Read when... |
|----------|------|-------------|
| Build status | `.claude/context/STATUS.md` | Starting any task |
| Product brief | `PROJECT.md` | Need product context |
| Agent details | `AGENTS.md` | Need handoff protocol |
| Data models | `.claude/context/data-models.md` | Working on DB or API |
| API contracts | `.claude/context/api-contracts.md` | Building or consuming endpoints |
| RAG pipeline | `.claude/context/rag-pipeline.md` | Working on crawl, embeddings, or chat |
| Domain terms | `.claude/context/domain-glossary.md` | Unsure about terminology |
| Design specs | `.claude/design-specs/*.md` | Implementing a designed component |

---

## Post-Task Protocol (Every Agent, Every Task)

When your task is complete:
1. Mark your task done in `.claude/context/STATUS.md` (change ⬜ to ✅)
2. Add a "What exists" note with file paths under the relevant phase
3. Update "Up Next" if the next logical task is clear
4. Add your branch to "Active Branches"
