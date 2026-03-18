-- ============================================================
-- match_chunks
-- pgvector cosine similarity search scoped to a single merchant.
-- Called from server routes via supabase.rpc('match_chunks', {...})
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
  -- S2: guard against null merchant_id to prevent cross-merchant data leaks
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'p_merchant_id must not be null';
  END IF;

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

-- S1 Fix: Restrict match_chunks to service_role only.
-- Supabase grants EXECUTE to PUBLIC (includes anon/authenticated) by default.
-- This function must only be callable from server routes via the service role key.
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_chunks(vector, float, int, uuid) TO service_role;
