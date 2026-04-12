import type { ChatStreamRequest, ChatChunkEvent, ChatSourcesEvent, ChatDoneEvent, ChatHistoryResponse } from '~/types/api'

interface SavedSession {
  sessionId: string
  preview: string
  startedAt: string
}

interface ChatMessage {
  id: string | null
  role: 'user' | 'assistant'
  content: string
}

export function useChat(options?: { brandId?: Ref<string | null> }) {
  const toast = useToast()
  const { merchant } = useMerchantConfig()

  const messages = ref<ChatMessage[]>([])
  const sources = ref<ChatSourcesEvent['chunks']>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const currentSessionId = ref(crypto.randomUUID())

  // Persisted session list — shared across composable instances via localStorage
  const savedSessions = useLocalStorage<SavedSession[]>('chat-sessions', [])

  let abortController: AbortController | null = null

  function parseSSE(buffer: string): { events: Array<{ event: string, data: string }>, remainder: string } {
    const events: Array<{ event: string, data: string }> = []
    const parts = buffer.split('\n\n')
    const remainder = parts.pop() ?? ''
    for (const part of parts) {
      let event = 'message'
      let data = ''
      for (const line of part.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data = line.slice(5).trim()
      }
      if (data) events.push({ event, data })
    }
    return { events, remainder }
  }

  async function send(text: string) {
    const widgetKey = merchant.value?.widget_config?.widget_key
    if (!widgetKey) {
      toast.add({ title: 'Error', description: 'Widget key not available. Complete a crawl first.', color: 'error' })
      return
    }

    error.value = null
    isStreaming.value = true
    messages.value.push({ id: null, role: 'user', content: text })
    messages.value.push({ id: null, role: 'assistant', content: '' })

    // Upsert current session into history (first message only — captures the preview)
    if (!savedSessions.value.some(s => s.sessionId === currentSessionId.value)) {
      savedSessions.value = [
        { sessionId: currentSessionId.value, preview: text.slice(0, 60), startedAt: new Date().toISOString() },
        ...savedSessions.value
      ]
    }

    abortController = new AbortController()
    const assistantIdx = messages.value.length - 1

    try {
      const body: ChatStreamRequest & { brand_id?: string } = {
        message: text,
        session_id: currentSessionId.value,
        widget_key: widgetKey,
        ...(options?.brandId?.value ? { brand_id: options.brandId.value } : {})
      }

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parsed = parseSSE(buffer)
        buffer = parsed.remainder

        for (const evt of parsed.events) {
          if (evt.event === 'chunk') {
            const { text: chunk } = JSON.parse(evt.data) as ChatChunkEvent
            messages.value[assistantIdx]!.content += chunk
          } else if (evt.event === 'sources') {
            sources.value = (JSON.parse(evt.data) as ChatSourcesEvent).chunks
          } else if (evt.event === 'done') {
            const { message_id } = JSON.parse(evt.data) as ChatDoneEvent
            messages.value[assistantIdx]!.id = message_id
          } else if (evt.event === 'error') {
            const errorData = JSON.parse(evt.data) as { message: string }
            error.value = errorData.message
            toast.add({ title: 'Chat error', description: errorData.message, color: 'error' })
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        error.value = 'Failed to send message'
        toast.add({ title: 'Chat error', description: 'Failed to send message.', color: 'error' })
      }
    } finally {
      isStreaming.value = false
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  async function loadSession(sessionId: string) {
    stop()
    try {
      const { messages: history } = await $fetch<ChatHistoryResponse>(`/api/chat/history/${sessionId}`)
      messages.value = history.map(m => ({ id: m.id, role: m.role, content: m.content }))
      currentSessionId.value = sessionId as ReturnType<typeof crypto.randomUUID>
      sources.value = []
      error.value = null
    } catch {
      toast.add({ title: 'Error', description: 'Failed to load conversation.', color: 'error' })
    }
  }

  function reset() {
    stop()
    messages.value = []
    sources.value = []
    error.value = null
    currentSessionId.value = crypto.randomUUID()
  }

  onUnmounted(() => {
    abortController?.abort()
  })

  return { messages, sources, isStreaming, error, currentSessionId, savedSessions, loadSession, send, stop, reset }
}
