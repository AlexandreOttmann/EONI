# Project Brief — Ecommerce AI SaaS

## One-line pitch

A SaaS that turns any website into an AI-discoverable, agent-powered storefront — so products appear in ChatGPT and Perplexity answers, and a smart chat agent lives on the merchant's site.

---

## The Problem

Shopify merchants can now sell directly inside ChatGPT. Non-Shopify merchants — travel agencies, boutique hotels, specialty retailers, experience businesses on custom stacks, Webflow, or Squarespace — have zero access to these tools. Nobody is building a turnkey solution for them.

---

## What We're Building

Three pillars, delivered as a self-serve SaaS:

**1. Content Ingestion Engine**
Crawl any merchant website (via Cloudflare `/crawl`) and transform it into structured, AI-ready data stored in a vector database (pgvector on Supabase). Keeps content fresh with incremental re-crawls. No custom infrastructure needed — one API call to Cloudflare handles JS rendering, pagination, and sitemap discovery.

**2. AI Visibility Layer** *(Phase 2)*
Auto-generate LLM-optimized static pages per merchant (`/c/[slug]/`) with Schema.org structured data, `llms.txt`, and sitemaps so AI crawlers (GPTBot, PerplexityBot, ClaudeBot) can discover and cite merchant products. Expose a per-merchant MCP endpoint so ChatGPT and Claude can query the catalog in real time.

**3. On-Site Agent**
A single `<script>` tag embeds a RAG-powered chat widget on any merchant site. The agent answers customer questions grounded in the merchant's own content, streams responses via SSE, detects booking intent, and can hand off to a human via WhatsApp or email.

**Automation Layer** *(Phase 2)*
Webhook events (`lead_detected`, `booking_intent_detected`, `crawl_completed`) that merchants configure in their dashboard and connect to n8n, Make, or their CRM.

---

## Target Customer

Non-Shopify merchants with rich product/service catalogs who are excluded from the current wave of AI commerce tools. Primary example: **Odysway** — a travel agency on a custom stack that wants its trips to appear in ChatGPT answers like "find me a trip to Japan in October under €2000."

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend + API | **Nuxt 4** | SSR dashboard + SSG catalog pages + server routes as API, one repo |
| Database + Auth + Vectors | **Supabase** (pgvector) | One DB eliminates Pinecone; RLS handles multi-tenancy; Realtime for crawl progress |
| Crawler | **Cloudflare /crawl** | Zero infra, JS rendering, incremental via `modifiedSince` |
| LLM | **Anthropic Claude Sonnet** | Better at multi-constraint queries (travel, dates, budget, group size) |
| Embeddings | **OpenAI text-embedding-3-small** | Cheap, fast, pgvector compatible |
| Widget CDN | **Cloudflare R2 + Workers** | Standalone Vite bundle ≤30kb, served globally at edge |
| UI | **Nuxt UI v3 + Motion for Vue (motion-v) + Lenis** | Component library on Tailwind v4 + Reka UI; spring micro-interactions + GSAP scroll storytelling on marketing pages |
| Email | **Resend** | Transactional only |
| Testing | **Playwright** | E2E across dashboard and widget |

---

## Architecture

```
Merchant Dashboard (Nuxt 4 SSR)
│
├── Crawl Pipeline
│   └── Merchant URL → Cloudflare /crawl → Markdown
│       → Chunk (500 tokens, 1 chunk = 1 product) → OpenAI embeddings
│       → pgvector (Supabase) + structured Postgres
│
├── RAG Chat Engine
│   └── User message → embed → pgvector similarity search (top 8 chunks)
│       → system prompt + context → Claude Sonnet stream → SSE → widget
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
    └── Supabase DB webhooks → Edge Functions → merchant webhook URLs
```

---

## Multi-Tenancy Model

Single Postgres schema with `merchant_id` on every table. Supabase Row Level Security enforces isolation. Widget reads always go through server-side API (service role key) — never exposed to the browser.

---

## RAG Pipeline Detail

```
User message
  → embed with text-embedding-3-small
  → pgvector cosine similarity search filtered by merchant_id (top 8, score ≥ 0.72)
  → build system prompt: "You are an assistant for {merchant}. Answer ONLY from context below."
  → append last 6 conversation turns
  → stream Claude Sonnet via SSE
  → persist conversation to Supabase
```

Chunking strategy: one chunk per product/trip with all metadata inline (price, dates, tags, destination). Always prepend merchant name and source URL to each chunk for citation.

---

## Roadmap

**Phase 1 — MVP (months 1–3):** On-site agent only. One `<script>` tag, 5-minute setup.
- Merchant auth (Supabase, email + Google OAuth)
- URL crawl + content ingestion
- RAG chat API with streaming
- Embeddable widget with GDPR notice
- Dashboard: crawl status, widget config, basic analytics

**Phase 2 — AI Visibility (months 4–6):** LLM-optimized pages, Schema.org, MCP endpoint.

**Phase 3 — Automation + Scale (months 7–12):** Webhook system, n8n node, multi-user accounts.

---

## Agent Setup

This project uses 6 specialized Claude sub-agents defined in `.claude/agents/`:

| Agent | Role |
|---|---|
| `product-manager` | Requirements, specs, roadmap, acceptance criteria |
| `frontend-developer` | Vue/Nuxt 4 pages, components, composables, Pinia stores |
| `backend-developer` | Supabase schema, API routes, RAG pipeline, crawl integration |
| `ui-ux-designer` | Design system, Tailwind tokens, shadcn/ui, Framer Motion variants |
| `security-auditor` | RLS policies, auth, GDPR, input validation, WCAG |
| `playwright-tester` | E2E tests, accessibility tests, CI integration |

Orchestration rules and handoff protocol are in `AGENTS.md`.

---

## Key Decisions

- **Cloudflare over Firecrawl/Apify** — native incremental crawl, no per-page fees, serverless
- **pgvector over Pinecone** — one DB, simpler at MVP scale (handles hundreds of thousands of vectors easily)
- **Claude Sonnet over GPT-4o** — handles multi-constraint travel queries better (dates, budget, group size, destination combined)
- **Standalone Vite widget** — completely decoupled from Nuxt; must load in <50ms on any host site
- **SSG for catalog pages** — pure HTML, no JS required to render, maximizes LLM crawler readability
- **merchant_id multi-tenancy** — simpler than per-schema isolation at MVP; Supabase RLS handles the rest