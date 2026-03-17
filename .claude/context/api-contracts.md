# API Contracts

> **Status:** Stub — backend-developer fills Zod schemas, response types, and error codes as routes are implemented. Frontend-developer consumes these contracts.

All routes live in `nuxt-app/server/api/`. Every route uses Zod for input validation.

---

## Auth Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | none | Email + password login via Supabase |
| POST | /api/auth/signup | none | New merchant registration |
| GET | /api/auth/callback | none | OAuth callback (Google) |
| GET | /api/auth/me | required | Current merchant profile |
| POST | /api/auth/logout | required | End session |

---

## Crawl Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/crawl/start | required | Trigger Cloudflare /crawl for merchant's domain |
| GET | /api/crawl/status/:jobId | required | Poll crawl job progress |
| GET | /api/crawl/jobs | required | List merchant's crawl jobs |

**Start Crawl Request:**
```typescript
// Zod schema TBD
{ url: string }
```

**Start Crawl Response:**
```typescript
{ jobId: string; status: 'pending' }
```

**Crawl Status Response:**
```typescript
{
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  pagesFound: number
  pagesCrawled: number
  chunksCreated: number
  error?: string
}
```

---

## Chat Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/chat/stream | widget-key | SSE streaming chat response |
| GET | /api/chat/history/:sessionId | required | Conversation history for dashboard |

**Chat Stream Request:**
```typescript
{
  message: string
  sessionId: string
  merchantId: string  // validated server-side against widget key
}
```

**Chat Stream Response:** SSE events
```
event: chunk
data: {"text": "partial response..."}

event: sources
data: {"chunks": [{"id": "...", "content": "...", "url": "..."}]}

event: done
data: {}
```

---

## Merchant Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/merchant/config | required | Get merchant profile + widget config |
| PATCH | /api/merchant/config | required | Update widget config |
| GET | /api/merchant/analytics | required | Conversation stats, top questions |

---

## MCP Routes (Phase 2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/mcp/:slug/search | MCP auth | Product search for AI agents |

---

## Webhook Routes (Phase 2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/webhooks/configs | required | List webhook configurations |
| POST | /api/webhooks/configs | required | Create webhook config |
| PATCH | /api/webhooks/configs/:id | required | Update webhook config |
| DELETE | /api/webhooks/configs/:id | required | Delete webhook config |

---

## Error Response Format

All error responses follow:
```typescript
{
  statusCode: number
  message: string
  data?: any  // validation errors, etc.
}
```

Never leak stack traces, SQL errors, or internal details in error responses.

---

## Auth Mechanism

- Supabase Auth handles session management
- Server routes use `serverSupabaseUser(event)` to get the authenticated user
- Service role routes use `serverSupabaseServiceRole(event)` for admin operations
- Widget routes authenticate via a merchant-specific widget key (not user session)
