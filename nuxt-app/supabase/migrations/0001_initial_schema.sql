-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- merchants
-- One row per SaaS customer. id mirrors auth.users.id.
-- ============================================================
CREATE TABLE merchants (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text NOT NULL UNIQUE,
  name                text NOT NULL,
  domain              text,
  widget_config       jsonb NOT NULL DEFAULT '{}',
  subscription_status text NOT NULL DEFAULT 'trial'
                        CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- crawl_jobs
-- One row per crawl run triggered by a merchant.
-- ============================================================
CREATE TABLE crawl_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  url             text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  pages_found     integer NOT NULL DEFAULT 0,
  pages_crawled   integer NOT NULL DEFAULT 0,
  chunks_created  integer NOT NULL DEFAULT 0,
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- pages
-- Each crawled URL stored as markdown.
-- ============================================================
CREATE TABLE pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  crawl_job_id uuid NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url          text NOT NULL,
  title        text,
  markdown     text,
  crawled_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- chunks
-- ~500-token semantic units used for RAG retrieval.
-- ============================================================
CREATE TABLE chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  page_id     uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  content     text NOT NULL,
  embedding   vector(1536),
  metadata    jsonb NOT NULL DEFAULT '{}',
  token_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- conversations
-- A chat session (widget or dashboard preview).
-- ============================================================
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  session_id  text NOT NULL,
  source      text NOT NULL DEFAULT 'widget'
                CHECK (source IN ('widget', 'dashboard_preview')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- messages
-- Individual turns within a conversation.
-- ============================================================
CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  merchant_id      uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user', 'assistant')),
  content          text NOT NULL,
  chunks_used      uuid[] NOT NULL DEFAULT '{}',
  confidence_score float,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- webhook_configs (Phase 2 — stub for forward compatibility)
-- ============================================================
CREATE TABLE webhook_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  url         text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

-- pgvector IVFFlat index for cosine similarity search
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- merchant_id lookups (btree)
CREATE INDEX ON chunks (merchant_id);
CREATE INDEX ON pages (merchant_id);
CREATE INDEX ON crawl_jobs (merchant_id);
CREATE INDEX ON conversations (merchant_id);
CREATE INDEX ON messages (merchant_id);
CREATE INDEX ON messages (conversation_id);
CREATE INDEX ON webhook_configs (merchant_id);

-- ============================================================
-- updated_at trigger for merchants
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
