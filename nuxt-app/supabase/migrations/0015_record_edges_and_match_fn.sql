-- ─── record_edges table ───────────────────────────────────────────────────────
-- Directed similarity edges between records that share a field value.
-- Used for 1-hop neighbor retrieval during RAG context expansion.

CREATE TABLE record_edges (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      uuid        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  source_record_id uuid        NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  target_record_id uuid        NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  edge_type        text        NOT NULL, -- 'category' | 'brand' | 'collection'
  edge_value       text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT record_edges_unique UNIQUE (source_record_id, target_record_id, edge_type)
);

CREATE INDEX record_edges_merchant_idx ON record_edges (merchant_id);
CREATE INDEX record_edges_source_idx   ON record_edges (source_record_id);
CREATE INDEX record_edges_target_idx   ON record_edges (target_record_id);

ALTER TABLE record_edges ENABLE ROW LEVEL SECURITY;

-- Edges are managed exclusively by service_role; no direct client access.
CREATE POLICY "record_edges: select own"
  ON record_edges FOR SELECT
  USING (auth.uid() = merchant_id);

-- Authenticated users cannot write edges directly; service_role bypasses RLS
CREATE POLICY "record_edges: no direct insert"
  ON record_edges FOR INSERT
  WITH CHECK (false);

CREATE POLICY "record_edges: no direct update"
  ON record_edges FOR UPDATE
  USING (false);

CREATE POLICY "record_edges: no direct delete"
  ON record_edges FOR DELETE
  USING (false);

-- ─── match_records() RPC ──────────────────────────────────────────────────────
-- Service-role only (REVOKE from public/anon/authenticated like match_products).

CREATE OR REPLACE FUNCTION match_records(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int,
  p_merchant_id   uuid,
  p_index_name    text DEFAULT NULL,
  p_brand_id      uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  object_id   text,
  index_name  text,
  fields      jsonb,
  similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.object_id,
    r.index_name,
    r.fields,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM records r
  WHERE r.merchant_id = p_merchant_id
    AND (p_index_name IS NULL OR r.index_name = p_index_name)
    AND (p_brand_id   IS NULL OR r.brand_id   = p_brand_id)
    AND r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) >= match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION match_records(vector, float, int, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION match_records(vector, float, int, uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION match_records(vector, float, int, uuid, text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION match_records(vector, float, int, uuid, text, uuid) TO service_role;
