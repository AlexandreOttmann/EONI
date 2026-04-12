-- R7: Semantic query cache
-- Caches validated RAG context keyed by (merchant_id, embedding fingerprint).
-- TTL = 10 minutes. Eliminates 2/3 LLM calls for repeated queries.

CREATE TABLE IF NOT EXISTS query_cache (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID       NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  cache_key  TEXT        NOT NULL,
  context_json JSONB     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  UNIQUE (merchant_id, cache_key)
);

-- Index for expiry-based cleanup and live-entry filtering at query time.
-- A partial index with WHERE expires_at > NOW() is not allowed because NOW()
-- is STABLE, not IMMUTABLE. The UNIQUE constraint on (merchant_id, cache_key)
-- already covers the lookup path efficiently.
CREATE INDEX query_cache_expiry_idx ON query_cache (expires_at);

-- RLS: table is server-side only (service role bypasses RLS)
ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;

-- No client-facing policies — service role has unrestricted access.
-- Expired rows accumulate until a periodic cleanup; the WHERE clause in
-- all queries (expires_at > NOW()) ensures stale data is never served.
