-- ─── indexes table ───────────────────────────────────────────────────────────
-- Stores merchant-defined index registrations so that indexes can exist before
-- any records are pushed. The records table remains the authoritative source of
-- record data; this table only tracks names + creation metadata.

CREATE TABLE indexes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT indexes_merchant_name_unique UNIQUE (merchant_id, name)
);

CREATE INDEX indexes_merchant_id_idx ON indexes (merchant_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indexes: select own"
  ON indexes FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "indexes: insert own"
  ON indexes FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "indexes: delete own"
  ON indexes FOR DELETE
  USING (auth.uid() = merchant_id);
