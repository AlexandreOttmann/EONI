-- ─── Reassign crawl brand RPC ────────────────────────────────────────────────
-- Phase B4 (brands architecture refactor): move every page/chunk/record that
-- belongs to a crawl job from one brand to another, transactionally.
--
-- The UI entry point is "I crawled the wrong brand" on the Brand detail page.
-- Reassigning by crawl_job_id is the natural unit because every downstream row
-- (pages, chunks, records) carries crawl_job_id either directly or via page_id.
--
-- Records do NOT have a top-level crawl_job_id column (verified in
-- migrations 0014_records_table.sql and 0017_products_to_records.sql — the
-- job id lives in fields->>'crawl_job_id'). Chunks link to a crawl job via
-- pages.crawl_job_id (chunks have no direct column).
--
-- Ownership is verified inside the function so the Nuxt endpoint does not have
-- to round-trip to the DB twice. Failures raise specific exceptions that the
-- endpoint translates into 403/404 — the raw messages must never leak to the
-- client.

CREATE OR REPLACE FUNCTION reassign_crawl_brand(
  p_merchant_id    uuid,
  p_crawl_job_id   uuid,
  p_target_brand_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_merchant   uuid;
  v_brand_merchant uuid;
  v_pages_count    int;
  v_chunks_count   int;
  v_records_count  int;
BEGIN
  IF p_merchant_id IS NULL OR p_crawl_job_id IS NULL OR p_target_brand_id IS NULL THEN
    RAISE EXCEPTION 'reassign_crawl_brand: arguments must not be null'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Ownership guard: crawl job must belong to caller's merchant.
  SELECT merchant_id INTO v_job_merchant
  FROM crawl_jobs
  WHERE id = p_crawl_job_id;

  IF v_job_merchant IS NULL THEN
    RAISE EXCEPTION 'crawl_job_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job_merchant <> p_merchant_id THEN
    RAISE EXCEPTION 'crawl_job_wrong_merchant' USING ERRCODE = '42501';
  END IF;

  -- 2. Ownership guard: target brand must belong to caller's merchant.
  SELECT merchant_id INTO v_brand_merchant
  FROM brands
  WHERE id = p_target_brand_id;

  IF v_brand_merchant IS NULL THEN
    RAISE EXCEPTION 'brand_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_brand_merchant <> p_merchant_id THEN
    RAISE EXCEPTION 'brand_wrong_merchant' USING ERRCODE = '42501';
  END IF;

  -- 3. Transactional updates. Functions run inside a single transaction by
  --    default in Postgres, so either all four statements succeed or all
  --    rollback together.

  -- 3a. Pages (direct crawl_job_id column).
  UPDATE pages
    SET brand_id = p_target_brand_id
    WHERE crawl_job_id = p_crawl_job_id
      AND merchant_id = p_merchant_id;
  GET DIAGNOSTICS v_pages_count = ROW_COUNT;

  -- 3b. Chunks (join via pages.crawl_job_id — chunks have no direct column).
  UPDATE chunks
    SET brand_id = p_target_brand_id
    WHERE merchant_id = p_merchant_id
      AND page_id IN (
        SELECT id FROM pages
        WHERE crawl_job_id = p_crawl_job_id
          AND merchant_id = p_merchant_id
      );
  GET DIAGNOSTICS v_chunks_count = ROW_COUNT;

  -- 3c. Records (joined via fields->>'crawl_job_id' — no top-level column).
  UPDATE records
    SET brand_id = p_target_brand_id
    WHERE merchant_id = p_merchant_id
      AND fields->>'crawl_job_id' = p_crawl_job_id::text;
  GET DIAGNOSTICS v_records_count = ROW_COUNT;

  -- 3d. The crawl job itself.
  UPDATE crawl_jobs
    SET brand_id = p_target_brand_id
    WHERE id = p_crawl_job_id
      AND merchant_id = p_merchant_id;

  -- 4. Invalidate query cache for this merchant. Stale cached contexts would
  --    still attribute records to the previous brand for up to 10 minutes
  --    otherwise (see migration 0022_query_cache.sql TTL).
  DELETE FROM query_cache WHERE merchant_id = p_merchant_id;

  RETURN jsonb_build_object(
    'pages',   v_pages_count,
    'chunks',  v_chunks_count,
    'records', v_records_count
  );
END;
$$;

REVOKE ALL ON FUNCTION reassign_crawl_brand(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reassign_crawl_brand(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION reassign_crawl_brand(uuid, uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION reassign_crawl_brand(uuid, uuid, uuid) TO service_role;
