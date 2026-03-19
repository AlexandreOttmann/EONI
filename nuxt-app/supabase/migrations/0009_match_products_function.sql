-- Migration: match_products vector similarity search function
-- Follows the same pattern as match_chunks (0003_match_chunks_function.sql)
-- with null-check guard and restricted execution permissions

CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_merchant_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  currency text,
  availability text,
  category text,
  source_url text,
  image_url text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'p_merchant_id must not be null';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.price,
    p.currency,
    p.availability,
    p.category,
    p.source_url,
    p.image_url,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.merchant_id = p_merchant_id
    AND p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Restrict execution to service_role only — never callable from client/anon sessions
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_products(vector, float, int, uuid) TO service_role;
