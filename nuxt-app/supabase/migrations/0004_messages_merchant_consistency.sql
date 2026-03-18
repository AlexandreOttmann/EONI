-- ============================================================
-- S2 Fix: Enforce messages.merchant_id consistency
-- Ensures messages.merchant_id always matches the merchant_id
-- of the parent conversation. Prevents cross-tenant data
-- corruption if a server route inserts with the wrong merchant_id.
-- ============================================================
CREATE OR REPLACE FUNCTION check_messages_merchant_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT merchant_id FROM conversations WHERE id = NEW.conversation_id) != NEW.merchant_id THEN
    RAISE EXCEPTION 'messages.merchant_id must match conversations.merchant_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_merchant_id_check
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION check_messages_merchant_id();
