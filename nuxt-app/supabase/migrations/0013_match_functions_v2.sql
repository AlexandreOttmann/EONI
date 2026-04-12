-- Migration: updated match functions with brand_id and content_type support
-- Part of Multi-Brand RAG + Content Categorization (Phase A)

-- match_chunks_by_type: pgvector search filtered by brand + content type
CREATE OR REPLACE FUNCTION match_chunks_by_type(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_merchant_id uuid,
  p_brand_id uuid DEFAULT NULL,
  p_content_types text[] DEFAULT ARRAY['brand','product','faq','support','other']
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'p_merchant_id must not be null';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE c.merchant_id = p_merchant_id
    AND c.embedding IS NOT NULL
    AND (p_brand_id IS NULL OR c.brand_id = p_brand_id)
    AND c.content_type = ANY(p_content_types)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION match_chunks_by_type(vector, float, int, uuid, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION match_chunks_by_type(vector, float, int, uuid, uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION match_chunks_by_type(vector, float, int, uuid, uuid, text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_chunks_by_type(vector, float, int, uuid, uuid, text[]) TO service_role;

-- Update match_products to support optional brand_id filter
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_merchant_id uuid,
  p_brand_id uuid DEFAULT NULL
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
    AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Re-apply permissions for the updated match_products (new signature with 5 params)
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION match_products(vector, float, int, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_products(vector, float, int, uuid, uuid) TO service_role;
