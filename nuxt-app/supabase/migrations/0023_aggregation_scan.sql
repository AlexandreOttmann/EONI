-- ─── Aggregation scan: full catalog fetch (no vector similarity) ──────────────
-- Used when query intent is 'aggregation' — returns ALL records for a merchant
-- up to p_limit, ordered by creation time. Bypasses the embedding bottleneck.
-- Mirrors permission pattern from 0018_hybrid_search.sql.

CREATE OR REPLACE FUNCTION list_records_for_aggregation(
  p_merchant_id  uuid,
  p_index_name   text DEFAULT 'products',
  p_brand_id     uuid DEFAULT NULL,
  p_limit        int  DEFAULT 150
)
RETURNS TABLE (
  object_id       text,
  fields          jsonb,
  searchable_text text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'p_merchant_id must not be null';
  END IF;

  RETURN QUERY
  SELECT r.object_id,
         r.fields,
         r.searchable_text
  FROM   records r
  WHERE  r.merchant_id = p_merchant_id
    AND  (p_index_name IS NULL OR r.index_name = p_index_name)
    AND  (p_brand_id   IS NULL OR r.brand_id   = p_brand_id)
  ORDER BY r.created_at ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION list_records_for_aggregation(uuid, text, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_records_for_aggregation(uuid, text, uuid, int) FROM anon;
REVOKE ALL ON FUNCTION list_records_for_aggregation(uuid, text, uuid, int) FROM authenticated;
GRANT  EXECUTE ON FUNCTION list_records_for_aggregation(uuid, text, uuid, int) TO service_role;
