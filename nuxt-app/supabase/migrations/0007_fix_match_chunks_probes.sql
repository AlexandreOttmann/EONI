-- ============================================================
-- Fix: match_chunks — increase ivfflat.probes for small merchant datasets
--
-- Root cause: default ivfflat.probes=1 searches only 1 of 100 lists.
-- With < 500 chunks (e.g. a freshly crawled 10-page site), most lists are
-- empty and the single probe misses all relevant chunks, returning 0 results.
-- Setting probes=10 provides full recall for merchants up to ~1000 chunks
-- with minimal performance impact at that scale.
-- ============================================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int,
  p_merchant_id    uuid
)
RETURNS TABLE (
  id          uuid,
  content     text,
  metadata    jsonb,
  similarity  float
)
LANGUAGE plpgsql AS $$
BEGIN
  -- Guard against null merchant_id to prevent cross-merchant data leaks
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'p_merchant_id must not be null';
  END IF;

  -- Increase probes so small merchants (< 1000 chunks) get full recall.
  -- Default probes=1 misses nearly everything when lists=100 but rows<500.
  SET LOCAL ivfflat.probes = 10;

  RETURN QUERY
  SELECT
    chunks.id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE
    chunks.merchant_id = p_merchant_id
    AND chunks.embedding IS NOT NULL
    AND 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Restrict to service_role only — same policy as original migration
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) TO service_role;
