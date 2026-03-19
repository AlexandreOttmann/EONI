## Feature: Developer API Docs Dashboard Page

**Phase:** 1.3
**Priority:** P1 (must-have — merchants need to see their API key and usage examples)
**Branch:** feat/dashboard-wiring (same branch as dashboard wiring)
**Depends on:** `backend-chat-api.md` (Bearer auth + non-streaming endpoint must exist)
**Depends on:** `frontend-dashboard-wiring.md` (`useMerchantConfig` composable must exist)

### User Story
As a merchant, I want a Developer API page in my dashboard that shows my API key and code examples, so I can integrate the chat into my own custom UI.

### Acceptance Criteria

- [ ] `app/pages/dashboard/api.vue` exists with "Developer API" page in dashboard
- [ ] Displays merchant's API key (widget_key) with copy-to-clipboard button
- [ ] Shows two sections/tabs: "Streaming (SSE)" and "Non-streaming (JSON)"
- [ ] Each section shows: endpoint URL, auth header format, request body, response format
- [ ] Curl and JavaScript `fetch()` code examples with copy buttons
- [ ] Rate limit info displayed (20 requests/minute)
- [ ] Sidebar navigation updated to include "API" link
- [ ] `pnpm typecheck` passes

### Technical Notes

#### Create `app/pages/dashboard/api.vue`

- Use `useMerchantConfig()` to load `widget_key`
- Use `UTabs` for Streaming vs Non-streaming sections
- Code blocks: use `<pre><code>` with Tailwind styling (bg-gray-900, text-sm, overflow-x-auto)
- Copy button on each code block (use `navigator.clipboard.writeText()`)
- Replace `<WIDGET_KEY>` placeholder in examples with actual key

#### Content for each tab

**Streaming tab:**
- Endpoint: `POST /api/chat/stream`
- Auth: `Authorization: Bearer <widget_key>`
- Body: `{ "message": "...", "session_id": "..." }`
- Response: SSE with events `sources`, `chunk`, `done`, `error`
- Curl + JS examples

**Non-streaming tab:**
- Endpoint: `POST /api/chat/message`
- Auth: `Authorization: Bearer <widget_key>`
- Body: `{ "message": "..." }` (session_id optional)
- Response: `{ "text", "sources", "message_id", "session_id", "conversation_id" }`
- Curl + JS examples

#### Update sidebar navigation

Edit `app/components/dashboard/Sidebar.vue` — add "API" nav item with code icon, linking to `/dashboard/api`

### Key Reference Files
- `app/composables/useMerchantConfig.ts` — reuse for widget_key loading
- `app/pages/dashboard/widget.vue` — reference for copy-to-clipboard pattern (install snippet)
- `app/components/dashboard/Sidebar.vue` — add nav item

### Required Context
- `.claude/specs/backend-chat-api.md` (endpoint contracts)

### Verification
1. `cd nuxt-app && pnpm typecheck` — no errors
2. API page loads, shows real widget_key
3. Copy buttons work
4. Sidebar shows "API" link
