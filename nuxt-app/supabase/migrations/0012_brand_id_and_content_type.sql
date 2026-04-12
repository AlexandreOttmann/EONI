-- Migration: add brand_id FK and content_type to existing tables
-- Part of Multi-Brand RAG + Content Categorization (Phase A)

-- Add brand_id to crawl_jobs, pages, chunks, products, conversations
ALTER TABLE crawl_jobs ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE pages ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE chunks ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;

-- Content categorization on chunks
ALTER TABLE chunks ADD COLUMN content_type text NOT NULL DEFAULT 'other'
  CHECK (content_type IN ('brand', 'product', 'faq', 'support', 'other'));

-- Indexes
CREATE INDEX idx_chunks_brand_type ON chunks(brand_id, content_type);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_crawl_jobs_brand ON crawl_jobs(brand_id);
