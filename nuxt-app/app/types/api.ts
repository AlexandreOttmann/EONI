// ============================================================
// Shared API types — owned by backend-developer.
// Consumed by frontend-developer via auto-imports or direct import.
// ============================================================

// ─── Database entity types ───────────────────────────────────

export interface Merchant {
  id: string
  email: string
  name: string
  domain: string | null
  widget_config: WidgetConfig
  subscription_status: 'trial' | 'active' | 'past_due' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface WidgetConfig {
  primary_color?: string
  welcome_message?: string
  position?: 'bottom-right' | 'bottom-left'
  widget_key?: string
}

export interface CrawlJob {
  id: string
  merchant_id: string
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  pages_found: number
  pages_crawled: number
  chunks_created: number
  products_extracted: number
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Product {
  id: string
  merchant_id: string
  page_id: string | null
  crawl_job_id: string
  name: string
  description: string | null
  price: number | null
  currency: string
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
  sku: string | null
  category: string | null
  image_url: string | null
  source_url: string
  extra_data: Record<string, unknown>
  extraction_confidence: 'high' | 'medium' | 'low'
  missing_fields: string[]
  created_at: string
}

export interface Page {
  id: string
  merchant_id: string
  crawl_job_id: string
  url: string
  title: string | null
  markdown: string | null
  crawled_at: string
}

export interface Chunk {
  id: string
  merchant_id: string
  page_id: string
  content: string
  metadata: ChunkMetadata
  token_count: number
  created_at: string
  // embedding is NOT returned to clients
}

export interface ChunkMetadata {
  price?: number
  currency?: string
  dates?: string[]
  tags?: string[]
  category?: string
  source_url?: string
}

export interface Conversation {
  id: string
  merchant_id: string
  session_id: string
  source: 'widget' | 'dashboard_preview'
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  merchant_id: string
  role: 'user' | 'assistant'
  content: string
  chunks_used: string[]
  confidence_score: number | null
  created_at: string
}

export interface WebhookConfig {
  id: string
  merchant_id: string
  event_type: string
  url: string
  active: boolean
  created_at: string
}

// ─── Auth route types ─────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
  }
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
  }
}

export interface SignupRequest {
  email: string
  password: string
  name: string
  domain?: string
}

export interface SignupResponse {
  user: {
    id: string
    email: string
  }
  merchant: Merchant
}

export interface MeResponse {
  merchant: Merchant
}

export interface LogoutResponse {
  success: true
}

// ─── Crawl route types ────────────────────────────────────────

export interface StartCrawlRequest {
  url: string
}

export interface StartCrawlResponse {
  job_id: string
  status: 'pending'
}

export interface CrawlStatusResponse {
  job: CrawlJob
}

export interface CrawlJobsResponse {
  jobs: CrawlJob[]
}

// ─── Chat route types ─────────────────────────────────────────

export interface ChatStreamRequest {
  message: string
  session_id: string
  widget_key: string
}

export interface ChatMessageRequest {
  message: string
  session_id?: string
  widget_key?: string
}

export interface ChatMessageResponse {
  text: string
  sources: Array<{ id: string, content: string, similarity: number }>
  message_id: string
  session_id: string
  conversation_id: string
}

// SSE event shapes (sent as JSON in the `data` field)
export interface ChatChunkEvent {
  text: string
}

export interface ChatSourcesEvent {
  chunks: Array<{
    id: string
    content: string
    metadata: ChunkMetadata
    similarity: number
  }>
}

export interface ChatDoneEvent {
  message_id: string
}

export interface ChatHistoryResponse {
  conversation: Conversation
  messages: Message[]
}

// ─── Merchant route types ─────────────────────────────────────

export interface MerchantConfigResponse {
  merchant: Merchant
}

export interface UpdateMerchantConfigRequest {
  name?: string
  domain?: string
  widget_config?: Partial<WidgetConfig>
}

export interface AnalyticsResponse {
  total_conversations: number
  total_messages: number
  top_questions: Array<{ content: string, count: number }>
  no_answer_rate: number
}

// ─── Error type ───────────────────────────────────────────────

export interface ApiError {
  statusCode: number
  message: string
}
