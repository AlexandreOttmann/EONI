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

export interface Brand {
  id: string
  merchant_id: string
  name: string
  /** Full list of domains this brand owns. Write path. */
  domains: string[]
  /**
   * Primary (first) domain — since migration 0039 this is a generated
   * Postgres column (`domains[1]`). Read-only; writes must go via `domains`.
   */
  domain: string | null
  description: string | null
  logo_url: string | null
  extracted_description: string | null
  created_at: string
  updated_at: string
}

export interface CrawlJob {
  id: string
  merchant_id: string
  brand_id: string | null
  url: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  pages_found: number
  pages_crawled: number
  chunks_created: number
  products_extracted: number
  page_limit: number
  include_patterns: string[]
  exclude_patterns: string[]
  error: string | null
  started_at: string | null
  completed_at: string | null
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
  brand_id: string | null
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
  limit?: number
  includePatterns?: string[]
  excludePatterns?: string[]
}

// ─── Crawl discover types ─────────────────────────────────────

export interface SitemapGroup {
  pattern: string
  label: string
  count: number
  sample_urls: string[]
}

export interface DiscoverResponse {
  sitemap_found: boolean
  total_urls: number
  groups: SitemapGroup[]
  ungrouped_count: number
}

export interface StartCrawlResponse {
  job_id: string
  status: 'pending'
  /**
   * Set when this crawl was the first to bind a brand to a domain.
   * The UI should toast "Brand domain set to ${brand_domain_claimed}".
   */
  brand_domain_claimed?: string
}

/**
 * Structured error data for HTTP 400 `brand_domain_mismatch` on
 * POST /api/crawl/start, POST /api/crawl/discover, and
 * POST /api/crawl/jobs/[id]/reassign-brand. Attached to the H3
 * error's `data` field.
 *
 * `brand_domains` is set by endpoints that surface the full multi-domain
 * list (reassign-brand since Phase B4). Older endpoints still set only
 * `brand_domain` — the frontend should prefer `brand_domains` when present.
 */
export interface BrandDomainMismatchError {
  code: 'brand_domain_mismatch'
  brand_id: string
  brand_domain: string
  brand_domains?: string[]
  crawl_domain: string
  message: string
  suggested_brand_name: string
}

// ─── Reassign crawl brand ─────────────────────────────────────

export interface ReassignCrawlBrandRequest {
  target_brand_id: string
}

export interface ReassignCrawlBrandResponse {
  job_id: string
  target_brand_id: string
  counts: {
    pages: number
    chunks: number
    records: number
  }
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
  brand_id?: string
}

export interface ChatMessageRequest {
  message: string
  session_id?: string
  widget_key?: string
  brand_id?: string
}

export interface ChatMessageResponse {
  text: string
  sources: Array<{ id: string, content: string, similarity: number }>
  records: Array<{ object_id: string, index_name: string, fields: Record<string, unknown>, similarity: number }>
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
    metadata?: ChunkMetadata
    similarity: number
  }>
  records?: Array<{ object_id: string, index_name: string, fields: Record<string, unknown>, similarity: number }>
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

// ─── Brand route types ────────────────────────────────────────

export interface CreateBrandRequest {
  name: string
  /** Convenience single-domain input. Wrapped to `domains: [domain]` server-side. */
  domain?: string
  /** Preferred multi-domain input. Normalized server-side via `extractRootDomain`. */
  domains?: string[]
}

export interface UpdateBrandRequest {
  name?: string
  /** Legacy — prefer `domains`. Still accepted for single-domain callers. */
  domain?: string
  /** Preferred multi-domain write path. Max 20 entries. */
  domains?: string[]
  description?: string
  logo_url?: string
}

export interface BrandWithCounts extends Brand {
  product_count: number
  chunk_count: number
}

export interface BrandListResponse {
  brands: BrandWithCounts[]
}

export interface BrandDetailResponse {
  brand: BrandWithCounts
}

export interface BrandResponse {
  brand: Brand
}

// ─── Product types (legacy products table) ────────────────────

export interface Product {
  id: string
  merchant_id: string
  brand_id: string | null
  name: string
  description: string | null
  price: number | null
  currency: string
  availability: string
  category: string | null
  source_url: string
  image_url: string | null
  sku: string | null
  embedding_model: string
  created_at: string
  updated_at: string
}

export interface ProductsListResponse {
  products: Product[]
  total: number
  page: number
  limit: number
}

// ─── Index / Records route types ─────────────────────────────

export interface IndexRecord {
  id: string
  merchant_id: string
  brand_id: string | null
  index_name: string
  object_id: string
  fields: Record<string, unknown>
  searchable_text: string
  created_at: string
  updated_at: string
}

export interface IndexSummary {
  indexName: string
  count: number
  updatedAt: string
}

export interface IndexesListResponse {
  indexes: IndexSummary[]
}

export interface CreateIndexRequest {
  name: string
}

export interface CreateIndexResponse {
  indexName: string
  createdAt: string
}

export interface IndexRecordsListResponse {
  records: Omit<IndexRecord, 'searchable_text'>[]
  total: number
}

export interface UpsertRecordRequest {
  fields: Record<string, unknown>
  brand_id?: string
}

export interface BatchRecordItem {
  objectID: string
  [key: string]: unknown
}

export interface BatchUpsertResponse {
  taskID: string
  indexName: string
  objectsCount: number
  status: 'processed'
}

export interface DeleteRecordResponse {
  objectId: string
  indexName: string
  status: 'deleted'
}

export interface ClearIndexResponse {
  indexName: string
  deletedCount: number
  status: 'cleared'
}

// ─── Error type ───────────────────────────────────────────────

export interface ApiError {
  statusCode: number
  message: string
}
