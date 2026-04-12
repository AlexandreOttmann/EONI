-- ─── Persistent rate limiting table + atomic increment function ──────────────
--
-- Replaces the in-memory Map in server/utils/chat.ts which resets on restart
-- and does not work across multiple server instances.
--
-- The increment_rate_limit function atomically:
--   1. Inserts a new window row if none exists for the key
--   2. Resets the counter if the current window has expired
--   3. Increments the counter within an active window
--   4. Returns whether the request is allowed (count <= max_requests)
--
-- Uses FOR UPDATE to prevent race conditions under concurrent requests.

CREATE TABLE IF NOT EXISTS rate_limits (
  key            TEXT        PRIMARY KEY,
  count          INTEGER     NOT NULL DEFAULT 0,
  window_start   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service role bypasses RLS; no client-facing policies needed.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ── Atomic increment + allow/deny function ────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key         TEXT,
  p_window_ms   INTEGER,  -- window size in milliseconds
  p_max_requests INTEGER  -- max allowed requests per window
)
RETURNS TABLE (allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now         TIMESTAMPTZ := NOW();
  v_window_secs FLOAT       := p_window_ms / 1000.0;
  v_count       INTEGER;
BEGIN
  -- Upsert: create row if missing, or lock existing row
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (p_key, 0, v_now)
  ON CONFLICT (key) DO NOTHING;

  -- Lock the row for atomic read-modify-write
  SELECT rl.count INTO v_count
  FROM rate_limits rl
  WHERE rl.key = p_key
  FOR UPDATE;

  -- Reset window if expired
  IF (SELECT EXTRACT(EPOCH FROM (v_now - rl.window_start)) > v_window_secs
      FROM rate_limits rl WHERE rl.key = p_key) THEN
    UPDATE rate_limits
    SET count = 1, window_start = v_now
    WHERE key = p_key;
    RETURN QUERY SELECT TRUE;
    RETURN;
  END IF;

  -- Increment within active window
  UPDATE rate_limits
  SET count = count + 1
  WHERE key = p_key
  RETURNING count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_max_requests);
END;
$$;

-- Lock down to service_role only — rate limiting is server-side only
REVOKE ALL ON FUNCTION increment_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION increment_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Optional: index for fast key lookups (already indexed by PRIMARY KEY)
-- No additional index needed.

-- Cleanup old rate limit rows (optional: add a scheduled job or pg_cron)
-- For now, rows are small and a simple periodic DELETE is sufficient.
