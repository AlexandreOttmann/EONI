# Domain Glossary

## Core Entities

**Merchant** — A business using the SaaS. Identified by `merchant_id` (UUID). Has a website domain, widget config, and subscription. Every row in every table belongs to exactly one merchant.

**Page** — A single URL crawled from a merchant's website. Stored as raw markdown after Cloudflare /crawl extraction. One page may produce one or more chunks.

**Chunk** — A segment of crawled content (~500 tokens). One chunk typically represents one product, trip, or service. Stored with its embedding vector (1536 dims) and metadata (price, dates, tags, source URL). The atomic unit for RAG retrieval.

**Embedding** — A 1536-dimensional vector from OpenAI `text-embedding-3-small`. Represents the semantic meaning of a chunk. Stored in pgvector for cosine similarity search.

**Crawl Job** — A background process that fetches a merchant's website via Cloudflare /crawl API. Tracks: pages discovered, pages crawled, status (pending/running/completed/failed). Supports incremental re-crawls via `modifiedSince`.

## Chat & RAG

**RAG (Retrieval-Augmented Generation)** — The core pattern: embed user query -> search similar chunks via pgvector -> build prompt with retrieved context -> stream LLM response. Grounds the AI in the merchant's actual content.

**Conversation** — A chat session between a visitor and the merchant's AI agent. Contains messages. Tied to a `session_id` (browser) and `merchant_id`.

**Message** — A single turn in a conversation. Has a `role` (user or assistant) and `content`. Assistant messages are streamed via SSE.

**SSE (Server-Sent Events)** — The protocol used to stream chat responses from the server to the client. One-way (server -> client). Used via `createEventStream()` in Nuxt server routes and `EventSource` on the client.

## Widget & Embedding

**Widget** — A standalone JavaScript bundle (<=30kb gzipped) that merchants embed on their site with a single `<script>` tag. Uses Shadow DOM to isolate CSS. Communicates with `/api/chat/stream` via SSE.

**Shadow DOM** — Browser API that encapsulates the widget's DOM and CSS, preventing conflicts with the host site's styles.

## AI Visibility (Phase 2)

**Catalog Page** — A statically generated (SSG) public page at `/c/[slug]/`. Pure HTML with Schema.org JSON-LD. Designed to be crawled and cited by LLM crawlers (GPTBot, PerplexityBot, ClaudeBot).

**MCP Endpoint** — Model Context Protocol API at `/api/mcp/[slug]/search`. Allows ChatGPT and Claude to query a merchant's catalog programmatically in real time.

**llms.txt** — A plaintext file that tells LLM crawlers what content is available and how to navigate the merchant's catalog. Analogous to robots.txt but for AI agents.

**Schema.org JSON-LD** — Structured data markup embedded in catalog pages. Helps search engines and AI systems understand product attributes (price, availability, category).

## Infrastructure

**pgvector** — PostgreSQL extension for vector similarity search. Used inside Supabase. Stores chunk embeddings and enables cosine similarity queries filtered by `merchant_id`.

**Supabase RLS (Row Level Security)** — PostgreSQL policies that enforce multi-tenancy at the database level. Every table has a policy ensuring users can only access rows matching their `merchant_id`.

**Cloudflare /crawl** — Cloudflare's browser rendering API. Crawls merchant websites with full JS execution. Supports incremental crawls via `modifiedSince`. Returns pages as markdown. Zero infrastructure needed.

**Service Role Key** — Supabase admin key that bypasses RLS. Used only in server routes, never exposed to the browser. Server routes must still explicitly filter by `merchant_id` even when using this key.

## UI Surfaces

**Dashboard** — The merchant-facing admin interface. Built with Nuxt UI v3 components. Includes: onboarding, crawl management, widget config, analytics, settings.

**Marketing Surface** — The public-facing landing page, pricing, and catalog pages. Built with custom GSAP + Lenis + Motion/Vue animations. Awwwards-grade quality.

**Agent** — In the context of this product, "agent" refers to the merchant's AI chat assistant (the widget). Not to be confused with Claude Code agents used for development.
