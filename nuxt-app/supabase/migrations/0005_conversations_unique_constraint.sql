-- Enable ON CONFLICT upsert in chat/stream route
ALTER TABLE conversations
  ADD CONSTRAINT conversations_merchant_session_unique
  UNIQUE (merchant_id, session_id);
