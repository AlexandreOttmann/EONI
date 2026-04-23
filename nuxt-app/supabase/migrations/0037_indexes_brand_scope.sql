-- ─── Brand-scope the indexes table ──────────────────────────────────────────
-- Phase B1 (brands architecture refactor): two brands inside one merchant can
-- now both own a `products` index without colliding. The index registry
-- becomes (merchant_id, brand_id, name) instead of just (merchant_id, name).
--
-- Requires Postgres 15+ (uses `UNIQUE NULLS NOT DISTINCT`). Supabase hosted
-- Postgres has been 15+ since 2023, so this is safe for all environments.

-- 1. Add brand_id (nullable to allow backfill of legacy rows that never had
--    a brand, and to cover registered-but-empty indexes that can't be
--    attributed to a single brand).
ALTER TABLE indexes
  ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE CASCADE;

-- 2. Backfill: for each existing (merchant_id, name), materialize one row per
--    brand that actually has records in that index. Legacy rows (where
--    records.brand_id IS NULL or no records exist) remain with brand_id=NULL
--    and are deduped by the NULLS NOT DISTINCT unique constraint below.
INSERT INTO indexes (merchant_id, brand_id, name, created_at)
SELECT DISTINCT r.merchant_id, r.brand_id, r.index_name, now()
FROM records r
WHERE r.brand_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM indexes i
    WHERE i.merchant_id = r.merchant_id
      AND i.brand_id    = r.brand_id
      AND i.name        = r.index_name
  );

-- 3. Swap unique constraints: old (merchant_id, name) → new (merchant_id, brand_id, name).
--    NULLS NOT DISTINCT treats two NULL brand_ids as equal, so legacy unbranded
--    indexes remain unique per merchant.
ALTER TABLE indexes
  DROP CONSTRAINT indexes_merchant_name_unique;

ALTER TABLE indexes
  ADD CONSTRAINT indexes_merchant_brand_name_unique
  UNIQUE NULLS NOT DISTINCT (merchant_id, brand_id, name);

-- 4. Lookup index for brand-scoped queries.
CREATE INDEX indexes_brand_id_idx ON indexes (brand_id);
