-- ─── Multi-domain brands ────────────────────────────────────────────────────
-- Phase B5 (brands architecture refactor): a brand can legitimately span
-- multiple domains (e.g. odysway.com + odysway.fr). Replace the single
-- `domain TEXT` with `domains TEXT[]` and keep `domain` as a generated column
-- pointing at `domains[1]` for backward compat.

-- 1. Add the new array column with an empty default so existing rows are valid.
ALTER TABLE brands
  ADD COLUMN domains text[] NOT NULL DEFAULT '{}';

-- 2. Backfill from the legacy single-domain column.
UPDATE brands
  SET domains = ARRAY[domain]
  WHERE domain IS NOT NULL AND domain <> '';

-- 3. Replace `domain` with a generated column that reflects domains[1].
--    Every existing `SELECT domain FROM brands` query keeps working — the
--    generated column returns the first (primary) domain, or NULL if empty.
ALTER TABLE brands DROP COLUMN domain;

ALTER TABLE brands ADD COLUMN domain text
  GENERATED ALWAYS AS (
    CASE WHEN array_length(domains, 1) > 0 THEN domains[1] ELSE NULL END
  ) STORED;

-- 4. GIN index to make `domains @> ARRAY[$1]` / `$1 = ANY(domains)` membership
--    checks cheap at scale.
CREATE INDEX brands_domains_gin_idx ON brands USING GIN (domains);
