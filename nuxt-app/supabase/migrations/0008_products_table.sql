-- Migration: products table for structured product data extracted at crawl time
-- Part of anti-hallucination RAG refactor (Part A)

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  page_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  crawl_job_id uuid NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric,
  currency text DEFAULT 'EUR',
  availability text CHECK (availability IN ('in_stock','out_of_stock','preorder','unknown')),
  sku text,
  category text,
  image_url text,
  source_url text NOT NULL,
  extra_data jsonb DEFAULT '{}',
  extraction_confidence text DEFAULT 'medium' CHECK (extraction_confidence IN ('high','medium','low')),
  missing_fields text[] DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_crawl_job ON products(crawl_job_id);
CREATE INDEX idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants see own products" ON products
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "Service role inserts products" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role deletes products" ON products
  FOR DELETE USING (true);

-- Track how many products were extracted per crawl job
ALTER TABLE crawl_jobs ADD COLUMN products_extracted integer DEFAULT 0;
