-- ─── Migrate IVFFlat → HNSW for chunks and records embeddings ────────────────
--
-- HNSW provides >95% recall at query time without requiring `ivfflat.probes`
-- tuning. It also performs better on small datasets (no minimum row requirement).
--
-- The SET LOCAL ivfflat.probes = 10 in match_chunks / match_chunks_by_type
-- is now irrelevant but kept for safety — HNSW ignores it.
--
-- Note: CONCURRENTLY is omitted because supabase db push wraps migrations in a
-- transaction and CONCURRENTLY cannot run inside one (SQLSTATE 25001).
-- The table-level lock will be brief on empty/small dev tables.

-- ── chunks.embedding ──────────────────────────────────────────────────────────
DROP INDEX IF EXISTS chunks_embedding_idx;

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── records.embedding ─────────────────────────────────────────────────────────
-- Drop existing IVFFlat index (name may vary; cover both common names)
DROP INDEX IF EXISTS records_embedding_idx;
DROP INDEX IF EXISTS idx_records_embedding;

CREATE INDEX IF NOT EXISTS records_embedding_idx
  ON records USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
