-- ─── Hybrid Search: tsvector + RRF ───────────────────────────────────────────
-- Adds full-text search capability alongside vector search for Reciprocal Rank Fusion.

-- 1. Add tsvector column
ALTER TABLE records ADD COLUMN IF NOT EXISTS searchable_tsv tsvector;

-- 2. Backfill from existing searchable_text
UPDATE records SET searchable_tsv = to_tsvector('simple', COALESCE(searchable_text, ''))
WHERE searchable_tsv IS NULL;

-- 3. Auto-update trigger: keeps searchable_tsv in sync with searchable_text
CREATE OR REPLACE FUNCTION records_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.searchable_tsv := to_tsvector('simple', COALESCE(NEW.searchable_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_records_tsv ON records;
CREATE TRIGGER trg_records_tsv
  BEFORE INSERT OR UPDATE OF searchable_text ON records
  FOR EACH ROW EXECUTE FUNCTION records_tsv_trigger();

-- 4. GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_records_tsv ON records USING GIN (searchable_tsv);

-- 5. Hybrid search RPC using Reciprocal Rank Fusion (k=60)
CREATE OR REPLACE FUNCTION match_records_hybrid(
  query_embedding   vector(1536),
  query_text        text,
  match_count       int,
  p_merchant_id     uuid,
  p_index_name      text DEFAULT NULL,
  p_brand_id        uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  object_id   text,
  index_name  text,
  fields      jsonb,
  similarity  float,
  rrf_score   float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rrf_k CONSTANT int := 60;
  oversample int := match_count * 4;
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT r.id, r.object_id, r.index_name, r.fields,
           r.embedding, r.searchable_tsv
    FROM records r
    WHERE r.merchant_id = p_merchant_id
      AND (p_index_name IS NULL OR r.index_name = p_index_name)
      AND (p_brand_id   IS NULL OR r.brand_id   = p_brand_id)
      AND r.embedding IS NOT NULL
  ),
  semantic AS (
    SELECT b.id,
           1 - (b.embedding <=> query_embedding) AS sim,
           ROW_NUMBER() OVER (ORDER BY b.embedding <=> query_embedding) AS rank_s
    FROM base b
    ORDER BY b.embedding <=> query_embedding
    LIMIT oversample
  ),
  keyword AS (
    SELECT b.id,
           ts_rank_cd(b.searchable_tsv, websearch_to_tsquery('simple', query_text)) AS kw_score,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank_cd(b.searchable_tsv, websearch_to_tsquery('simple', query_text)) DESC
           ) AS rank_k
    FROM base b
    WHERE b.searchable_tsv @@ websearch_to_tsquery('simple', query_text)
    LIMIT oversample
  ),
  fused AS (
    SELECT COALESCE(s.id, k.id) AS id,
           COALESCE(s.sim, 0.0)::float AS sim,
           (COALESCE(1.0 / (rrf_k + s.rank_s), 0.0)
            + COALESCE(1.0 / (rrf_k + k.rank_k), 0.0))::float AS score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT b.id, b.object_id, b.index_name, b.fields,
         f.sim AS similarity,
         f.score AS rrf_score
  FROM fused f
  JOIN base b ON b.id = f.id
  ORDER BY f.score DESC
  LIMIT match_count;
END;
$$;

-- Lock down permissions (service_role only, like match_records)
REVOKE ALL ON FUNCTION match_records_hybrid(vector, text, int, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION match_records_hybrid(vector, text, int, uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION match_records_hybrid(vector, text, int, uuid, text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION match_records_hybrid(vector, text, int, uuid, text, uuid) TO service_role;
