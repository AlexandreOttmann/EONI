-- Migration: brands table for multi-brand support
-- Part of Multi-Brand RAG + Content Categorization (Phase A)

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  description text,
  logo_url text,
  extracted_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_brands_merchant ON brands(merchant_id);

-- updated_at trigger (reuses existing function from 0001)
CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Authenticated user policies (merchant_id = auth.uid())
CREATE POLICY "brands_select_own" ON brands
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "brands_insert_own" ON brands
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "brands_update_own" ON brands
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "brands_delete_own" ON brands
  FOR DELETE USING (merchant_id = auth.uid());

-- Service role policies (for server-side operations)
CREATE POLICY "Service role selects brands" ON brands
  FOR SELECT USING (true);

CREATE POLICY "Service role inserts brands" ON brands
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role updates brands" ON brands
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Service role deletes brands" ON brands
  FOR DELETE USING (true);
