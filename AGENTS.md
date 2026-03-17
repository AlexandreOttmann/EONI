# AGENTS.md — Ecommerce AI SaaS

## Project Overview

A SaaS that turns any ecommerce or service website into an AI-discoverable, agent-powered catalog. Merchants get:
1. **Content Ingestion** — Crawl their site (via Cloudflare /crawl) into a vector + structured DB
2. **AI Visibility Layer** — LLM-optimized pages, Schema.org, MCP endpoint so products appear in ChatGPT/Perplexity answers
3. **On-Site Agent** — Embeddable chat widget powered by RAG over the merchant's content
4. **Automation Layer** — Webhook events (lead detected, booking intent) for n8n/Make

## Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Frontend + API | **Nuxt 4** | SSR dashboard + SSG public pages + API routes |
| Database + Auth + Vectors | **Supabase** (pgvector) | One DB, row-level security, no Pinecone needed at MVP |
| Crawler | **Cloudflare /crawl** | Zero infra, JS rendering, incremental via `modifiedSince` |
| Widget CDN | **Cloudflare R2 + Workers** | Standalone Vite bundle ~30kb |
| LLM Inference | **Anthropic Claude Sonnet** | Multi-constraint queries (travel, dates, budget) |
| Embeddings | **OpenAI text-embedding-3-small** | Cheap, fast, pgvector compatible |
| Email | **Resend** | Transactional only |
| UI | **Nuxt UI v3 + Motion for Vue (motion-v) + Lenis** | Component library built on Tailwind v4 + Reka UI; spring animations + smooth scroll |
| Testing | **Playwright** | E2E across dashboard + widget |

## Repository Structure

```
/
├── AGENTS.md                  # This file
├── .claude/agents/            # Sub-agent skills
├── app/
│   ├── components/            # Vue components (shadcn wrappers + custom)
│   ├── composables/           # Nuxt composables
│   ├── layouts/               # App + auth + public layouts
│   ├── pages/                 # Dashboard, public catalog, auth pages
│   ├── stores/                # Pinia stores
│   └── middleware/            # Auth guards
├── server/
│   ├── api/                   # Nuxt server routes (API layer)
│   │   ├── chat/              # RAG chat endpoint
│   │   ├── crawl/             # Crawl trigger + status
│   │   ├── mcp/               # MCP endpoint per merchant
│   │   └── webhooks/          # Supabase + Cloudflare webhooks
│   ├── utils/                 # Server-side utilities
│   └── middleware/            # Server middleware
├── supabase/
│   ├── migrations/            # SQL migrations
│   └── functions/             # Edge functions (Deno)
├── tests/
│   └── e2e/                   # Playwright tests
├── public/                    # Static assets
├── widget/                    # Standalone widget (Vite build, separate)
│   ├── src/
│   └── vite.config.ts
├── nuxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Multi-Agent Workflow

This project uses a **specialized agent per domain**. Each agent has deep context about its area and calls others as needed. The orchestration model is:

```
User Request
    │
    ▼
[Orchestrator] — reads STATUS.md, routes to the right specialist(s)
    │
    ├─► [product-manager]     — specs, roadmap, acceptance criteria, STATUS.md
    ├─► [frontend-developer]  — Vue/Nuxt pages, components, composables, Pinia
    ├─► [backend-developer]   — API routes, Supabase, RAG pipeline, crawl, SSE
    ├─► [ui-ux-designer]      — Design system, Tailwind tokens, GSAP, Motion/Vue
    ├─► [security-auditor]    — RLS, auth, GDPR, OWASP, a11y
    └─► [playwright-tester]   — E2E tests, fixtures, CI, axe-core a11y
```

### Shared Context Files

Every agent reads `.claude/context/STATUS.md` first. Additional context by area:

| Context File | Path | Used By |
|-------------|------|---------|
| Build status | `.claude/context/STATUS.md` | All agents |
| Data models | `.claude/context/data-models.md` | backend, frontend, security |
| API contracts | `.claude/context/api-contracts.md` | backend, frontend, tester |
| RAG pipeline | `.claude/context/rag-pipeline.md` | backend |
| Domain glossary | `.claude/context/domain-glossary.md` | All agents |
| Design specs | `.claude/design-specs/*.md` | frontend (reads), ui-ux (writes) |

### Handoff Protocol

- **product-manager → all**: Writes feature spec with acceptance criteria before implementation starts. Updates STATUS.md.
- **frontend ↔ backend**: API contract types in `nuxt-app/types/api.ts`. Backend writes, frontend consumes.
- **ui-ux-designer → frontend**: Design specs saved to `.claude/design-specs/[feature].md`.
- **security-auditor**: Must review all Supabase RLS changes, all new API routes, and all auth-related code before merge.
- **playwright-tester**: Writes tests in parallel with features; tests must pass before any feature is considered done.

### Post-Task Rule (All Agents)

When any agent completes a task, it MUST update `.claude/context/STATUS.md`:
1. Mark the task ✅ in the relevant phase table
2. Add a "What exists" note with file paths
3. Update "Up Next" if the next logical task is clear
4. Add the working branch to "Active Branches"

### Slash Commands

| Command | Description |
|---------|------------|
| `/status` | Print current build status summary |
| `/plan` | Product-manager writes a feature spec |
| `/design` | UI/UX designer produces a component spec |
| `/review` | Security auditor runs review checklist |
| `/test` | Playwright tester generates E2E tests |

## Key Architectural Decisions

### Multi-tenancy
Use `merchant_id` (UUID) on every table — not separate schemas. Supabase Row Level Security enforces isolation. Never expose `merchant_id` to client without server-side validation.

### RAG Pipeline
```
User message
  → embed with text-embedding-3-small
  → pgvector similarity search (top 8 chunks, score > 0.75)
  → build prompt: system + merchant context + retrieved chunks + history (last 6 turns)
  → stream Claude Sonnet response via SSE
  → store conversation in Supabase
```
Always include `merchant_id` filter in vector search — never leak chunks across merchants.

### Widget Architecture
The widget is a **completely separate Vite bundle** from the Nuxt app. It must:
- Load in < 50ms (target 30kb gzipped)
- Use Shadow DOM to prevent CSS conflicts
- Communicate with `/api/chat` via SSE for streaming
- Never bundle Nuxt, Vue Router, or Pinia

### Streaming
All chat responses stream via Server-Sent Events. Nuxt server routes use `createEventStream()`. Never return a full response for chat — streaming is a UX requirement.

### LLM-Optimized Public Pages
Generated at crawl time via `nuxt generate`. Each merchant gets:
- `/c/[slug]/` — merchant hub
- `/c/[slug]/[category]/` — category pages
- `/c/[slug]/products/[product-slug]` — individual product
These pages: pure server-rendered HTML, Schema.org JSON-LD, `llms.txt`, auto-generated sitemap.

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# OpenAI (embeddings only)
OPENAI_API_KEY=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_CRAWL_API_TOKEN=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=

# Resend
RESEND_API_KEY=

# App
NUXT_PUBLIC_APP_URL=
NUXT_PUBLIC_WIDGET_CDN_URL=
```

## Development Commands

```bash
# Install
pnpm install

# Dev
pnpm dev

# Widget dev (separate terminal)
pnpm widget:dev

# Type check
pnpm typecheck

# E2E tests
pnpm test:e2e

# Supabase local
pnpm supabase start
pnpm supabase db push

# Build
pnpm build
pnpm widget:build
```

## Code Quality Standards

- **TypeScript strict mode** — no `any`, all API responses typed
- **Zod** — validate all external inputs (API payloads, env vars)
- **ESLint + Prettier** via `@antfu/eslint-config`
- **Conventional commits** — `feat:`, `fix:`, `chore:`, etc.
- **Test coverage** — every user-facing flow has a Playwright test
- **GDPR** — no PII stored without consent, EU Supabase region, cookie banner on widget
