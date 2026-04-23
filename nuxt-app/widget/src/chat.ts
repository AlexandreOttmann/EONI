export interface WidgetProduct {
  id: string
  name: string
  price: number | null
  currency: string
  category: string | null
  source_url: string
  image_url: string | null
  similarity: number
}

export interface SSECallbacks {
  onChunk: (text: string) => void
  onSources: (chunks: unknown[], products: WidgetProduct[]) => void
  onDone: (messageId: string | null) => void
  onError: (message: string) => void
}

interface SSEEvent {
  event: string
  data: string
}

function parseSSE(buffer: string): { events: SSEEvent[]; remainder: string } {
  const events: SSEEvent[] = []
  const parts = buffer.split('\n\n')
  // The last element is the unconsumed remainder (possibly empty or partial)
  const remainder = parts.pop() ?? ''
  for (const part of parts) {
    let event = 'message'
    let data = ''
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim()
      }
    }
    if (data) events.push({ event, data })
  }
  return { events, remainder }
}

export class SSEClient {
  private abort: AbortController | null = null

  async stream(
    apiBase: string,
    widgetKey: string,
    sessionId: string,
    message: string,
    callbacks: SSECallbacks,
  ): Promise<void> {
    this.abort = new AbortController()

    let response: Response
    try {
      response = await fetch(`${apiBase}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          widget_key: widgetKey,
        }),
        signal: this.abort.signal,
      })
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      callbacks.onError('Failed to connect to the chat service.')
      return
    }

    if (!response.ok || !response.body) {
      callbacks.onError(`Stream request failed (HTTP ${response.status}).`)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parsed = parseSSE(buffer)
        buffer = parsed.remainder

        for (const evt of parsed.events) {
          if (evt.event === 'chunk') {
            const payload = JSON.parse(evt.data) as { text: string }
            callbacks.onChunk(payload.text)
          } else if (evt.event === 'sources') {
            const payload = JSON.parse(evt.data) as { chunks: unknown[]; products?: WidgetProduct[] }
            callbacks.onSources(payload.chunks, payload.products ?? [])
          } else if (evt.event === 'done') {
            const payload = JSON.parse(evt.data) as { message_id: string | null }
            callbacks.onDone(payload.message_id)
          } else if (evt.event === 'error') {
            const payload = JSON.parse(evt.data) as { message: string }
            callbacks.onError(payload.message)
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError('Lost connection to the chat service.')
      }
    } finally {
      reader.releaseLock()
      this.abort = null
    }
  }

  cancel(): void {
    this.abort?.abort()
    this.abort = null
  }
}
