import { SSEClient, type WidgetProduct } from './chat'
import { getStyles } from './styles'
import { renderMarkdown } from './markdown'

export interface WidgetConfig {
  apiBase: string
  widgetKey: string
  color: string
  position: 'bottom-right' | 'bottom-left'
}

type State = 'closed' | 'consent' | 'open' | 'chatting'

// SVG icon helpers — avoids innerHTML while keeping SVG readable
function makeSvgIcon(paths: string[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of paths) {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
  }
  return svg
}

const CHAT_ICON = [
  'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
]
const CLOSE_ICON = ['M18 6 6 18', 'M6 6l12 12']
const SEND_ICON = ['M22 2 11 13', 'M22 2 15 22 11 13 2 9l20-7z']

const CONSENT_KEY_PREFIX = 'eoni-consent-'

export class WidgetHost {
  private readonly config: WidgetConfig
  private shadow: ShadowRoot | null = null
  private state: State = 'closed'
  private sseClient = new SSEClient()
  private sessionId = crypto.randomUUID()
  private streamingEl: HTMLElement | null = null
  private streamingText = ''
  private pendingProducts: WidgetProduct[] = []

  // Cached DOM refs set during mount()
  private panel!: HTMLElement
  private fab!: HTMLButtonElement
  private messagesEl!: HTMLElement
  private inputEl!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private consentEl!: HTMLElement

  constructor(config: WidgetConfig) {
    this.config = config
  }

  // ── Mount ──────────────────────────────────────────────────────────────────

  mount(): void {
    const host = document.createElement('div')
    host.setAttribute('role', 'complementary')
    host.setAttribute('aria-label', 'Chat assistant')
    document.body.appendChild(host)

    this.shadow = host.attachShadow({ mode: 'closed' })

    // Inject styles
    const style = document.createElement('style')
    style.textContent = getStyles(this.config.color, this.config.position)
    this.shadow.appendChild(style)

    // Build DOM tree
    this.shadow.appendChild(this.buildFab())
    this.shadow.appendChild(this.buildPanel())

    // If user already consented in a previous visit, skip consent step
    const consentKey = `${CONSENT_KEY_PREFIX}${this.config.widgetKey}`
    if (sessionStorage.getItem(consentKey) === '1') {
      this.consentEl.hidden = true
    }

    // Initial state — panel hidden
    this.panel.setAttribute('aria-hidden', 'true')
  }

  // ── DOM builders ───────────────────────────────────────────────────────────

  private buildFab(): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.id = 'eoni-fab'
    btn.setAttribute('aria-label', 'Open chat')
    btn.setAttribute('aria-expanded', 'false')
    btn.setAttribute('aria-haspopup', 'dialog')
    btn.appendChild(makeSvgIcon(CHAT_ICON))
    btn.addEventListener('click', () => this.onFabClick())
    this.fab = btn
    return btn
  }

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.id = 'eoni-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', 'Chat with us')

    // Header
    const header = document.createElement('div')
    header.id = 'eoni-header'

    const title = document.createElement('p')
    title.id = 'eoni-header-title'
    title.textContent = 'Chat with us'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    closeBtn.id = 'eoni-close-btn'
    closeBtn.setAttribute('aria-label', 'Close chat')
    closeBtn.appendChild(makeSvgIcon(CLOSE_ICON))
    closeBtn.addEventListener('click', () => this.transitionTo('closed'))
    header.appendChild(closeBtn)

    panel.appendChild(header)

    // Messages area
    const messages = document.createElement('div')
    messages.id = 'eoni-messages'
    messages.setAttribute('aria-live', 'polite')
    messages.setAttribute('aria-atomic', 'false')
    panel.appendChild(messages)
    this.messagesEl = messages

    // Input row
    panel.appendChild(this.buildInputRow())

    // Consent overlay (layered on top)
    panel.appendChild(this.buildConsent())

    this.panel = panel
    return panel
  }

  private buildInputRow(): HTMLElement {
    const row = document.createElement('div')
    row.id = 'eoni-input-row'

    const textarea = document.createElement('textarea')
    textarea.id = 'eoni-input'
    textarea.setAttribute('placeholder', 'Ask something…')
    textarea.setAttribute('aria-label', 'Message')
    textarea.setAttribute('rows', '1')
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.handleSend()
      }
    })
    textarea.addEventListener('input', () => {
      // auto-grow
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`
      this.sendBtn.disabled = textarea.value.trim().length === 0 || this.state === 'chatting'
    })
    this.inputEl = textarea

    const sendBtn = document.createElement('button')
    sendBtn.id = 'eoni-send-btn'
    sendBtn.setAttribute('aria-label', 'Send message')
    sendBtn.disabled = true
    sendBtn.appendChild(makeSvgIcon(SEND_ICON))
    sendBtn.addEventListener('click', () => this.handleSend())
    this.sendBtn = sendBtn

    row.appendChild(textarea)
    row.appendChild(sendBtn)
    return row
  }

  private buildConsent(): HTMLElement {
    const overlay = document.createElement('div')
    overlay.id = 'eoni-consent'

    const title = document.createElement('p')
    title.id = 'eoni-consent-title'
    title.textContent = 'Chat with our AI assistant'
    overlay.appendChild(title)

    const body = document.createElement('p')
    body.id = 'eoni-consent-body'
    body.textContent =
      'This chat uses AI. Messages may be stored to improve answers. Do you agree to continue?'
    overlay.appendChild(body)

    const accept = document.createElement('button')
    accept.id = 'eoni-consent-accept'
    accept.textContent = 'Start chatting'
    accept.addEventListener('click', () => this.onConsentAccept())
    overlay.appendChild(accept)

    const decline = document.createElement('button')
    decline.id = 'eoni-consent-decline'
    decline.textContent = 'No thanks'
    decline.addEventListener('click', () => this.transitionTo('closed'))
    overlay.appendChild(decline)

    this.consentEl = overlay
    return overlay
  }

  // ── State machine ─────────────────────────────────────────────────────────

  private transitionTo(next: State): void {
    this.state = next

    const isOpen = next === 'open' || next === 'consent' || next === 'chatting'
    this.panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true')
    this.fab.setAttribute('aria-expanded', isOpen ? 'true' : 'false')

    if (next === 'closed') {
      this.sseClient.cancel()
    }

    if (next === 'open') {
      // Focus the input when opening into chat mode
      requestAnimationFrame(() => this.inputEl.focus())
    }

    if (next === 'consent') {
      // Focus the accept button for keyboard users
      requestAnimationFrame(() => {
        const accept = this.shadow?.getElementById('eoni-consent-accept') as HTMLButtonElement | null
        accept?.focus()
      })
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private onFabClick(): void {
    if (this.state !== 'closed') {
      this.transitionTo('closed')
      return
    }

    const consentKey = `${CONSENT_KEY_PREFIX}${this.config.widgetKey}`
    const hasConsent = sessionStorage.getItem(consentKey) === '1'

    if (hasConsent) {
      this.transitionTo('open')
    } else {
      this.transitionTo('consent')
    }
  }

  private onConsentAccept(): void {
    const consentKey = `${CONSENT_KEY_PREFIX}${this.config.widgetKey}`
    sessionStorage.setItem(consentKey, '1')
    this.consentEl.hidden = true
    this.transitionTo('open')
  }

  private handleSend(): void {
    const text = this.inputEl.value.trim()
    if (!text || this.state === 'chatting') return

    this.inputEl.value = ''
    this.inputEl.style.height = 'auto'
    this.sendBtn.disabled = true

    this.send(text)
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  private send(message: string): void {
    this.transitionTo('chatting')

    // Append user bubble
    this.appendMessage('user', message)

    // Show typing indicator and capture reference to the element
    // that will be replaced with the streamed assistant text
    const typingEl = this.appendTypingIndicator()

    let firstChunk = true
    this.streamingEl = null
    this.streamingText = ''

    this.sseClient.stream(
      this.config.apiBase,
      this.config.widgetKey,
      this.sessionId,
      message,
      {
        onChunk: (text) => {
          if (firstChunk) {
            firstChunk = false
            // Remove typing indicator and create the assistant bubble
            typingEl.remove()
            this.streamingEl = this.appendMessage('assistant', '')
          }
          this.streamingText += text
          this.appendChunk(text)
        },
        onSources: (_chunks, products) => {
          this.pendingProducts = products
        },
        onDone: (_messageId) => {
          // Replace raw streamed text with rendered markdown
          if (this.streamingEl && this.streamingText.length > 0) {
            this.streamingEl.textContent = ''
            this.streamingEl.appendChild(renderMarkdown(this.streamingText))
          }
          // Append product cards below the assistant message bubble
          if (this.pendingProducts.length > 0 && this.streamingEl) {
            this.streamingEl.appendChild(this.renderProductCards(this.pendingProducts))
          }
          this.pendingProducts = []
          this.streamingText = ''
          this.streamingEl = null
          this.transitionTo('open')
          requestAnimationFrame(() => this.inputEl.focus())
        },
        onError: (errorMessage) => {
          typingEl.remove()
          if (this.streamingEl) {
            // Error arrived mid-stream — append inline
            this.streamingEl.textContent += '\n\nSomething went wrong. Please try again.'
          } else {
            // No text received yet — show error bubble
            const errEl = this.appendMessage('assistant', '')
            errEl.textContent = errorMessage || 'Something went wrong. Please try again.'
          }
          this.streamingEl = null
          this.transitionTo('open')
          requestAnimationFrame(() => this.inputEl.focus())
          console.warn('[Eoni] Chat error:', errorMessage)
        },
      },
    )
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  private appendMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const el = document.createElement('div')
    el.className = `eoni-msg eoni-msg--${role}`
    el.textContent = text
    this.messagesEl.appendChild(el)
    this.scrollToBottom()
    return el
  }

  private appendTypingIndicator(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'eoni-typing'
    el.setAttribute('aria-label', 'Assistant is typing')
    for (let i = 0; i < 3; i++) {
      el.appendChild(document.createElement('span'))
    }
    this.messagesEl.appendChild(el)
    this.scrollToBottom()
    return el
  }

  private appendChunk(text: string): void {
    if (!this.streamingEl) return
    this.streamingEl.textContent += text
    this.scrollToBottom()
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  private renderProductCards(products: WidgetProduct[]): HTMLElement {
    const container = document.createElement('div')
    container.className = 'eoni-products'

    for (const p of products) {
      const card = document.createElement('a')
      card.className = 'eoni-product-card'
      card.href = p.source_url
      card.target = '_blank'
      card.rel = 'noopener noreferrer'

      if (p.image_url?.startsWith('http')) {
        const img = document.createElement('img')
        img.src = p.image_url
        img.alt = p.name
        img.loading = 'lazy'
        card.appendChild(img)
      }

      const info = document.createElement('div')
      info.className = 'eoni-product-info'

      const name = document.createElement('p')
      name.className = 'eoni-product-name'
      name.textContent = p.name
      info.appendChild(name)

      if (p.price != null) {
        const price = document.createElement('p')
        price.className = 'eoni-product-price'
        price.textContent = `${p.currency} ${p.price.toLocaleString()}`
        info.appendChild(price)
      }

      card.appendChild(info)
      container.appendChild(card)
    }

    return container
  }
}
