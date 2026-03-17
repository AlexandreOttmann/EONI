# Project Overview

A SaaS that turns any website into an AI-discoverable, agent-powered storefront. Non-Shopify merchants (travel agencies, boutique hotels, specialty retailers on custom stacks, Webflow, or Squarespace) get a turnkey solution: crawl their site, power a RAG chat widget, and generate LLM-optimized catalog pages so their products appear in ChatGPT and Perplexity answers.

## Architecture

```
Merchant Dashboard (Nuxt 4 SSR)
│
├── Crawl Pipeline
│   └── Merchant URL -> Cloudflare /crawl -> Markdown
│       -> Chunk (500 tokens, 1 chunk = 1 product) -> OpenAI embeddings
│       -> pgvector (Supabase) + structured Postgres
│
├── RAG Chat Engine
│   └── User message -> embed -> pgvector similarity search (top 8 chunks)
│       -> system prompt + context -> Claude Sonnet stream -> SSE -> widget
│
├── Embeddable Widget
│   └── Standalone Vite bundle, Shadow DOM, <script> one-liner
│       Communicates with /api/chat/stream via SSE
│
├── AI Visibility (Phase 2)
│   └── SSG pages at /c/[slug]/ — pure HTML, Schema.org, llms.txt
│       MCP endpoint at /api/mcp/[slug]/search
│
└── Automation Layer (Phase 2)
    └── Supabase DB webhooks -> Edge Functions -> merchant webhook URLs
```

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend + API | Nuxt 4 (SSR dashboard + SSG catalog + API routes) |
| Database + Auth + Vectors | Supabase (pgvector, RLS, Realtime) |
| Crawler | Cloudflare /crawl |
| LLM Inference | Anthropic Claude Sonnet |
| Embeddings | OpenAI text-embedding-3-small (1536 dims) |
| UI Components | Nuxt UI v3 (Tailwind v4 + Reka UI) |
| Animations | Motion for Vue (motion-v) + GSAP + Lenis |
| Widget CDN | Cloudflare R2 + Workers |
| Email | Resend |
| Testing | Playwright |

## Folder Structure

```
ecommerce-ai-saas/
├── CLAUDE.md              # Root context (always loaded)
├── AGENTS.md              # Agent orchestration map
├── PROJECT.md             # Product brief (stable)
├── .claude/
│   ├── agents/            # 6 agent definitions
│   ├── context/           # STATUS.md, data models, glossary, etc.
│   ├── design-specs/      # UI/UX -> Frontend handoff specs
│   └── commands/          # Slash commands (/status, /plan, /design, /review, /test)
└── nuxt-app/              # All application code
    ├── app/               # Vue pages, components, composables, stores
    ├── server/api/        # Nuxt server routes (API layer)
    ├── supabase/          # Migrations + Edge Functions
    ├── widget/            # Standalone Vite build
    └── tests/e2e/         # Playwright tests
```

## Multi-Tenancy

Single Postgres schema with `merchant_id` (UUID) on every table. Supabase RLS enforces tenant isolation. Widget reads go through server-side API (service role key) — never exposed to browser. Every query, every vector search, every API response filters by `merchant_id`.

## Target Customer

Non-Shopify merchants with rich product/service catalogs. Primary example: **Odysway** — a travel agency that wants trips to appear in ChatGPT answers like "find me a trip to Japan in October under 2000EUR."
