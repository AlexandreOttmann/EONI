-- ── Migrate products rows into records ─────────────────────────────────────
INSERT INTO records (merchant_id, brand_id, index_name, object_id, fields, searchable_text, embedding, created_at, updated_at)
SELECT
  merchant_id,
  brand_id,
  'products',
  COALESCE(source_url, id::text),
  jsonb_build_object(
    'name', name,
    'description', description,
    'price', price,
    'currency', currency,
    'availability', availability,
    'sku', sku,
    'category', category,
    'image_url', image_url,
    'source_url', source_url,
    'extraction_confidence', extraction_confidence,
    'missing_fields', to_jsonb(missing_fields),
    'crawl_job_id', crawl_job_id::text,
    'page_id', page_id::text
  ) || COALESCE(extra_data, '{}'),
  'Product: ' || name || E'\n' || COALESCE('Description: ' || description, '') || E'\n' || COALESCE('Category: ' || category, ''),
  embedding,
  created_at,
  updated_at
FROM products
ON CONFLICT (merchant_id, index_name, object_id) DO NOTHING;

-- ── Drop products table and associated functions ────────────────────────────
DROP TABLE products CASCADE;

DROP FUNCTION IF EXISTS match_products(vector, float, int, uuid);
DROP FUNCTION IF EXISTS match_products(vector, float, int, uuid, uuid);
