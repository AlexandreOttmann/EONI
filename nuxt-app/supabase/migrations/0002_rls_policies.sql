-- ============================================================
-- Row Level Security Policies
-- Server routes use service role (bypasses RLS) and MUST
-- filter by merchant_id explicitly. These policies protect
-- direct client-side Supabase access only.
-- ============================================================

-- merchants: a user can only access their own row
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchants_select_own" ON merchants
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "merchants_insert_own" ON merchants
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "merchants_update_own" ON merchants
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "merchants_delete_own" ON merchants
  FOR DELETE USING (id = auth.uid());

-- ============================================================
-- crawl_jobs
-- ============================================================
ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crawl_jobs_select_own" ON crawl_jobs
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "crawl_jobs_insert_own" ON crawl_jobs
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "crawl_jobs_update_own" ON crawl_jobs
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "crawl_jobs_delete_own" ON crawl_jobs
  FOR DELETE USING (merchant_id = auth.uid());

-- ============================================================
-- pages
-- ============================================================
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pages_select_own" ON pages
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "pages_insert_own" ON pages
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "pages_update_own" ON pages
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "pages_delete_own" ON pages
  FOR DELETE USING (merchant_id = auth.uid());

-- ============================================================
-- chunks
-- ============================================================
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_own" ON chunks
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "chunks_insert_own" ON chunks
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "chunks_update_own" ON chunks
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "chunks_delete_own" ON chunks
  FOR DELETE USING (merchant_id = auth.uid());

-- ============================================================
-- conversations
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_own" ON conversations
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "conversations_insert_own" ON conversations
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "conversations_update_own" ON conversations
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "conversations_delete_own" ON conversations
  FOR DELETE USING (merchant_id = auth.uid());

-- ============================================================
-- messages
-- ============================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (merchant_id = auth.uid());

-- ============================================================
-- webhook_configs
-- ============================================================
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_configs_select_own" ON webhook_configs
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "webhook_configs_insert_own" ON webhook_configs
  FOR INSERT WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "webhook_configs_update_own" ON webhook_configs
  FOR UPDATE USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "webhook_configs_delete_own" ON webhook_configs
  FOR DELETE USING (merchant_id = auth.uid());
