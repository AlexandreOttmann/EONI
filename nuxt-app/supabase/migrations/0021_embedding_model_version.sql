-- ─── Add embedding_model column to chunks and records ────────────────────────
--
-- Tracks which OpenAI embedding model produced each row's embedding vector.
-- This enables future model upgrades (e.g. text-embedding-3-large) to be
-- identified and selectively re-embedded without touching existing rows that
-- are already on the target model.
--
-- Default: 'text-embedding-3-small' — matches the current embedder.ts config.
-- Note: embedder.ts uses text-embedding-3-large with dimensions=1536; the
-- column value should reflect the actual model used at insert time.

ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-large';

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-large';

-- Index to allow efficient "re-embed all rows using old model" queries
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_model  ON chunks  (embedding_model);
CREATE INDEX IF NOT EXISTS idx_records_embedding_model ON records (embedding_model);
