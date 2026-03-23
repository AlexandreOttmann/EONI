<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Developer API' })

const { merchant } = useMerchantConfig()

const widgetKey = computed(() => merchant.value?.widget_config?.widget_key ?? '')
const maskedKey = computed(() => {
  const key = widgetKey.value
  if (key.length <= 8) return key
  return `${key.slice(0, 4)}${'*'.repeat(key.length - 8)}${key.slice(-4)}`
})

const isKeyRevealed = ref(false)
const displayedKey = computed(() => isKeyRevealed.value ? widgetKey.value : maskedKey.value)

const copiedStates = reactive<Record<string, boolean>>({})

function copyToClipboard(text: string, id: string) {
  navigator.clipboard.writeText(text)
  copiedStates[id] = true
  setTimeout(() => {
    copiedStates[id] = false
  }, 2000)
}

// --- Code examples ---

const baseUrl = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }
  return 'https://your-domain.com'
})

// Streaming tab examples
const streamingCurl = computed(() =>
  `curl -N -X POST ${baseUrl.value}/api/chat/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${widgetKey.value || '<WIDGET_KEY>'}" \\
  -d '{
    "message": "What products do you have?",
    "session_id": "optional-session-id"
  }'`
)

const streamingJs = computed(() =>
  `const response = await fetch("${baseUrl.value}/api/chat/stream", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${widgetKey.value || '<WIDGET_KEY>'}"
  },
  body: JSON.stringify({
    message: "What products do you have?",
    session_id: "optional-session-id"
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split("\\n");

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      const event = line.slice(7);
      // Events: "sources", "chunk", "done", "error"
    }
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      // Handle event data
    }
  }
}`
)

// Non-streaming tab examples
const nonStreamingCurl = computed(() =>
  `curl -X POST ${baseUrl.value}/api/chat/message \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${widgetKey.value || '<WIDGET_KEY>'}" \\
  -d '{
    "message": "What products do you have?",
    "session_id": "optional-session-id"
  }'`
)

const nonStreamingJs = computed(() =>
  `const response = await fetch("${baseUrl.value}/api/chat/message", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${widgetKey.value || '<WIDGET_KEY>'}"
  },
  body: JSON.stringify({
    message: "What products do you have?"
  })
});

const data = await response.json();
// data = {
//   text: "Here are our products...",
//   sources: [{ title: "...", url: "...", score: 0.95 }],
//   products: [{ name: "...", price: 29.99, ... }],
//   message_id: "uuid",
//   session_id: "uuid",
//   conversation_id: "uuid"
// }`
)

interface TabItem {
  label: string
  value: string
  icon: string
  slot: string
}

const tabItems: TabItem[] = [
  { label: 'Streaming (SSE)', value: 'streaming', icon: 'i-heroicons-signal', slot: 'streaming' },
  { label: 'Non-streaming (JSON)', value: 'non-streaming', icon: 'i-heroicons-document-text', slot: 'non-streaming' }
]
</script>

<template>
  <div>
    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6"
      style="text-wrap: balance"
    >
      Developer API
    </h1>

    <div class="space-y-6 max-w-4xl">
      <!-- API Key section -->
      <section aria-labelledby="api-key-heading">
        <UCard>
          <template #header>
            <h2
              id="api-key-heading"
              class="text-sm font-medium text-text-base"
            >
              Your API Key
            </h2>
          </template>
          <div class="space-y-3">
            <p class="text-sm text-text-muted">
              Use this key to authenticate requests to the chat API. Include it as a Bearer token in the Authorization header.
            </p>
            <div class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{{ displayedKey || 'Loading\u2026' }}</code></pre>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UButton
                  :icon="isKeyRevealed ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :aria-label="isKeyRevealed ? 'Hide API key' : 'Reveal API key'"
                  @click="isKeyRevealed = !isKeyRevealed"
                />
                <UButton
                  :icon="copiedStates['api-key'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :aria-label="copiedStates['api-key'] ? 'Copied!' : 'Copy API key'"
                  :disabled="!widgetKey"
                  @click="copyToClipboard(widgetKey, 'api-key')"
                />
              </div>
            </div>
            <p class="text-xs text-text-subtle">
              Keep this key secret. Do not expose it in client-side code that is publicly accessible.
            </p>
          </div>
        </UCard>
      </section>

      <!-- Rate limits -->
      <section aria-labelledby="rate-limits-heading">
        <UCard>
          <template #header>
            <h2
              id="rate-limits-heading"
              class="text-sm font-medium text-text-base"
            >
              Rate Limits
            </h2>
          </template>
          <div class="flex items-start gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 shrink-0">
              <UIcon
                name="i-heroicons-clock"
                class="w-4.5 h-4.5 text-warning"
              />
            </div>
            <div>
              <p class="text-sm text-text-base font-medium">
                20 requests per minute
              </p>
              <p class="text-xs text-text-muted mt-0.5">
                Rate limiting is applied per API key. Exceeding this limit will return a 429 status code. Implement exponential backoff in your client for best results.
              </p>
            </div>
          </div>
        </UCard>
      </section>

      <!-- Auth header format -->
      <section aria-labelledby="auth-heading">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2
                id="auth-heading"
                class="text-sm font-medium text-text-base"
              >
                Authentication
              </h2>
            </div>
          </template>
          <div class="space-y-3">
            <p class="text-sm text-text-muted">
              All API requests must include the Authorization header with your API key as a Bearer token.
            </p>
            <div class="relative">
              <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 pr-12 overflow-x-auto"><code>Authorization: Bearer {{ widgetKey || '&lt;WIDGET_KEY&gt;' }}</code></pre>
              <UButton
                :icon="copiedStates['auth-header'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                variant="ghost"
                color="neutral"
                size="xs"
                class="absolute top-2 right-2"
                :aria-label="copiedStates['auth-header'] ? 'Copied!' : 'Copy auth header'"
                @click="copyToClipboard(`Authorization: Bearer ${widgetKey}`, 'auth-header')"
              />
            </div>
          </div>
        </UCard>
      </section>

      <!-- API Reference tabs -->
      <section aria-labelledby="api-reference-heading">
        <h2
          id="api-reference-heading"
          class="text-lg font-display font-semibold text-text-base mb-3"
        >
          API Reference
        </h2>

        <UTabs
          :items="tabItems"
          variant="pill"
          size="sm"
          class="w-full"
        >
          <!-- Streaming tab content -->
          <template #streaming="{ item: _item }">
            <div class="mt-4 space-y-5">
              <!-- Endpoint -->
              <UCard>
                <template #header>
                  <div class="flex items-center gap-2">
                    <UBadge
                      color="success"
                      variant="subtle"
                      size="xs"
                    >
                      POST
                    </UBadge>
                    <code class="text-sm font-mono text-text-base">/api/chat/stream</code>
                  </div>
                </template>
                <div class="space-y-4">
                  <p class="text-sm text-text-muted">
                    Sends a chat message and receives the response as a Server-Sent Events (SSE) stream. Ideal for real-time chat interfaces where you want to display tokens as they arrive.
                  </p>

                  <!-- Request body -->
                  <div>
                    <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-2">
                      Request body
                    </h4>
                    <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{
  "message": "string (required)",
  "session_id": "string (optional — omit to start a new conversation)"
}</code></pre>
                  </div>

                  <!-- Response format -->
                  <div>
                    <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-2">
                      SSE events
                    </h4>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-border-base">
                            <th class="text-left py-2 pr-4 font-mono text-xs text-text-muted font-medium">
                              Event
                            </th>
                            <th class="text-left py-2 pr-4 font-mono text-xs text-text-muted font-medium">
                              Data
                            </th>
                            <th class="text-left py-2 font-mono text-xs text-text-muted font-medium">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody class="text-text-base">
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              <UBadge
                                color="primary"
                                variant="subtle"
                                size="xs"
                              >
                                sources
                              </UBadge>
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              JSON array of source objects
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Sent first, contains retrieved context sources
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              <UBadge
                                color="primary"
                                variant="subtle"
                                size="xs"
                              >
                                chunk
                              </UBadge>
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              Text token string
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Individual text tokens as they are generated
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              <UBadge
                                color="success"
                                variant="subtle"
                                size="xs"
                              >
                                done
                              </UBadge>
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              Session metadata JSON
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Stream complete, includes session_id and message_id
                            </td>
                          </tr>
                          <tr>
                            <td class="py-2 pr-4 font-mono text-xs">
                              <UBadge
                                color="error"
                                variant="subtle"
                                size="xs"
                              >
                                error
                              </UBadge>
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              Error message string
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Sent if an error occurs during streaming
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </UCard>

              <!-- Curl example -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
                    curl example
                  </h4>
                  <UButton
                    :icon="copiedStates['stream-curl'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="copiedStates['stream-curl'] ? 'Copied!' : 'Copy curl example'"
                    @click="copyToClipboard(streamingCurl, 'stream-curl')"
                  />
                </div>
                <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{{ streamingCurl }}</code></pre>
              </div>

              <!-- JavaScript example -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
                    JavaScript fetch() example
                  </h4>
                  <UButton
                    :icon="copiedStates['stream-js'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="copiedStates['stream-js'] ? 'Copied!' : 'Copy JavaScript example'"
                    @click="copyToClipboard(streamingJs, 'stream-js')"
                  />
                </div>
                <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{{ streamingJs }}</code></pre>
              </div>
            </div>
          </template>

          <!-- Non-streaming tab content -->
          <template #non-streaming="{ item: _item }">
            <div class="mt-4 space-y-5">
              <!-- Endpoint -->
              <UCard>
                <template #header>
                  <div class="flex items-center gap-2">
                    <UBadge
                      color="success"
                      variant="subtle"
                      size="xs"
                    >
                      POST
                    </UBadge>
                    <code class="text-sm font-mono text-text-base">/api/chat/message</code>
                  </div>
                </template>
                <div class="space-y-4">
                  <p class="text-sm text-text-muted">
                    Sends a chat message and receives the complete response as a single JSON object. Simpler to implement than SSE but does not support real-time token streaming.
                  </p>

                  <!-- Request body -->
                  <div>
                    <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-2">
                      Request body
                    </h4>
                    <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{
  "message": "string (required)",
  "session_id": "string (optional — omit to start a new conversation)"
}</code></pre>
                  </div>

                  <!-- Response format -->
                  <div>
                    <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-2">
                      Response body
                    </h4>
                    <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{
  "text": "string — the assistant's response",
  "sources": [
    {
      "title": "string — page title",
      "url": "string — source URL",
      "score": 0.95
    }
  ],
  "products": [
    {
      "name": "string — product name",
      "price": 29.99,
      "currency": "USD",
      "url": "string — product URL"
    }
  ],
  "message_id": "uuid",
  "session_id": "uuid",
  "conversation_id": "uuid"
}</code></pre>
                  </div>

                  <!-- Response fields table -->
                  <div>
                    <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-2">
                      Response fields
                    </h4>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-border-base">
                            <th class="text-left py-2 pr-4 font-mono text-xs text-text-muted font-medium">
                              Field
                            </th>
                            <th class="text-left py-2 pr-4 font-mono text-xs text-text-muted font-medium">
                              Type
                            </th>
                            <th class="text-left py-2 font-mono text-xs text-text-muted font-medium">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody class="text-text-base">
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              text
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              string
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              The assistant's complete response text
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              sources
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              array
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Retrieved context sources with title, URL, and relevance score
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              products
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              array
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Matched product data (name, price, currency, URL)
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              message_id
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              uuid
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Unique identifier for this message
                            </td>
                          </tr>
                          <tr class="border-b border-border-base/50">
                            <td class="py-2 pr-4 font-mono text-xs">
                              session_id
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              uuid
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Session identifier (reuse to continue the conversation)
                            </td>
                          </tr>
                          <tr>
                            <td class="py-2 pr-4 font-mono text-xs">
                              conversation_id
                            </td>
                            <td class="py-2 pr-4 text-xs text-text-muted">
                              uuid
                            </td>
                            <td class="py-2 text-xs text-text-muted">
                              Conversation identifier for analytics
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </UCard>

              <!-- Curl example -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
                    curl example
                  </h4>
                  <UButton
                    :icon="copiedStates['msg-curl'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="copiedStates['msg-curl'] ? 'Copied!' : 'Copy curl example'"
                    @click="copyToClipboard(nonStreamingCurl, 'msg-curl')"
                  />
                </div>
                <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{{ nonStreamingCurl }}</code></pre>
              </div>

              <!-- JavaScript example -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
                    JavaScript fetch() example
                  </h4>
                  <UButton
                    :icon="copiedStates['msg-js'] ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :aria-label="copiedStates['msg-js'] ? 'Copied!' : 'Copy JavaScript example'"
                    @click="copyToClipboard(nonStreamingJs, 'msg-js')"
                  />
                </div>
                <pre class="text-sm font-mono bg-gray-950 text-gray-200 rounded-lg px-4 py-3 overflow-x-auto"><code>{{ nonStreamingJs }}</code></pre>
              </div>
            </div>
          </template>
        </UTabs>
      </section>

      <!-- Accessibility: announce copy state -->
      <div
        v-if="Object.values(copiedStates).some(Boolean)"
        aria-live="polite"
        class="sr-only"
      >
        Copied to clipboard
      </div>
    </div>
  </div>
</template>
