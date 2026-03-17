# Ecommerce AI SaaS

Turn any website into an AI-discoverable, agent-powered storefront. Non-Shopify merchants get a turnkey solution: crawl their site, power a RAG chat widget on their pages, and generate LLM-optimized catalog pages so products appear in ChatGPT and Perplexity answers.

## What It Does

**Content Ingestion** — Crawl any merchant website via Cloudflare /crawl, chunk content into ~500-token segments, embed with OpenAI, and store in pgvector for retrieval.

**On-Site Agent** — A single `<script>` tag embeds a RAG-powered chat widget (<=30kb, Shadow DOM) on any merchant site. Streams Claude Sonnet responses via SSE, grounded in the merchant's own content.

**AI Visibility** *(Phase 2)* — Auto-generate LLM-optimized static pages with Schema.org, `llms.txt`, and a per-merchant MCP endpoint so AI crawlers can discover and cite products.

**Automation** *(Phase 2)* — Webhook events (`lead_detected`, `booking_intent`, `crawl_completed`) for n8n, Make, or CRM integrations.

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend + API | Nuxt 4 (SSR dashboard + SSG catalog + server routes) |
| Database + Auth + Vectors | Supabase (pgvector, RLS, Realtime) |
| Crawler | Cloudflare /crawl |
| LLM | Anthropic Claude Sonnet |
| Embeddings | OpenAI text-embedding-3-small |
| UI | Nuxt UI v3 (Tailwind v4 + Reka UI) |
| Animations | Motion for Vue + GSAP + Lenis |
| Widget | Standalone Vite bundle, Cloudflare R2 |
| Testing | Playwright + axe-core |

## Project Structure

```
ecommerce-ai-saas/
├── nuxt-app/              # All application code
│   ├── app/               # Vue pages, components, composables, stores
│   ├── server/api/        # Nuxt server routes (API layer)
│   ├── supabase/          # Migrations, RLS policies, Edge Functions
│   └── tests/e2e/         # Playwright E2E tests
├── widget/                # Standalone Vite chat widget bundle
├── .claude/
│   ├── agents/            # 6 specialized agent definitions
│   ├── context/           # STATUS.md, data models, API contracts, RAG pipeline
│   ├── design-specs/      # UI/UX -> Frontend handoff artifacts
│   └── commands/          # /status, /plan, /design, /review, /test
├── CLAUDE.md              # Root context for Claude Code sessions
├── AGENTS.md              # Multi-agent orchestration map
└── PROJECT.md             # Product brief
```

## Getting Started

```bash
# Install dependencies
cd nuxt-app && pnpm install

# Start dev server
pnpm dev

# Type check
pnpm typecheck

# Run E2E tests
pnpm test:e2e

# Build for production
pnpm build
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_CRAWL_API_TOKEN=
```

## Architecture

```
Merchant URL -> Cloudflare /crawl -> Markdown -> Chunk -> Embed -> pgvector

User Query -> Embed -> pgvector search (top 8, merchant_id filter)
          -> System prompt + chunks + history -> Claude Sonnet stream -> SSE -> Widget
```

Multi-tenancy via `merchant_id` on every table. Supabase RLS enforces tenant isolation. Chat always streams via SSE — never a single HTTP response.

## Agent Workflow

This project uses 6 specialized Claude Code agents coordinated by a product-manager:

| Agent | Role |
|-------|------|
| product-manager | Specs, roadmap, acceptance criteria, status tracking |
| frontend-developer | Vue/Nuxt pages, components, composables |
| backend-developer | API routes, Supabase schema, RAG pipeline |
| ui-ux-designer | Design system, animations (GSAP + Motion/Vue) |
| security-auditor | RLS review, auth audit, GDPR, a11y |
| playwright-tester | E2E tests, accessibility, CI |


Start any session: CLAUDE.md auto-loads with rules and agent team
Run `/status` — see where the project stands
/plan [feature] — product-manager writes a spec with acceptance criteria and agent routing
/design [feature] — ui-ux-designer outputs a component spec to design-specs/
Invoke backend-developer or frontend-developer to implement
/review — security-auditor gates the merge
/test — playwright-tester writes E2E coverage
Every agent updates STATUS.md when done — next agent picks up where the last left off

## License

Proprietary. All rights reserved.
