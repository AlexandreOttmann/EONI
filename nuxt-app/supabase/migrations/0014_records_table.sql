-- ─── records table ───────────────────────────────────────────────────────────
-- Algolia-style push indexing. Each record is an arbitrary JSON object that
-- merchants push via API. Embeddings power semantic search via match_records().

CREATE TABLE records (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  brand_id        uuid        REFERENCES brands(id) ON DELETE SET NULL,
  index_name      text        NOT NULL,
  object_id       text        NOT NULL,
  fields          jsonb       NOT NULL DEFAULT '{}',
  searchable_text text        NOT NULL DEFAULT '',
  embedding       vector(1536),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one record per (merchant, index, object)
ALTER TABLE records
  ADD CONSTRAINT records_merchant_index_object_unique
  UNIQUE (merchant_id, index_name, object_id);

-- updated_at trigger (reuse existing function if present)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER records_updated_at
  BEFORE UPDATE ON records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX records_merchant_id_idx
  ON records (merchant_id);

CREATE INDEX records_merchant_index_idx
  ON records (merchant_id, index_name);

-- ivfflat cosine similarity index for pgvector search
CREATE INDEX records_embedding_idx
  ON records USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "records: select own"
  ON records FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "records: insert own"
  ON records FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "records: update own"
  ON records FOR UPDATE
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "records: delete own"
  ON records FOR DELETE
  USING (auth.uid() = merchant_id);
