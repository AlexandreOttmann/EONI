import type { DOMPurify, Config as DOMPurifyConfig } from 'dompurify'

interface MarkdownRenderer {
  render: (src: string) => string
}

let md: MarkdownRenderer | null = null
let purify: DOMPurify | null = null
let initPromise: Promise<void> | null = null

async function init(): Promise<void> {
  const [markdownItModule, dompurifyModule] = await Promise.all([
    import('markdown-it'),
    import('dompurify')
  ])

  // markdown-it uses `export =` so the constructor lands on `.default` in ESM interop
  const MarkdownIt = markdownItModule.default as unknown as new (options: {
    html: boolean
    linkify: boolean
    breaks: boolean
  }) => {
    render: (src: string) => string
    renderer: {
      rules: Record<string, ((...args: unknown[]) => string) | undefined>
    }
  }

  const instance = new MarkdownIt({ html: false, linkify: true, breaks: true })

  // Open all links in new tab with noopener noreferrer
  const defaultRender = instance.renderer.rules.link_open
  instance.renderer.rules.link_open = function (...args: unknown[]): string {
    const [tokens, idx] = args
    // tokens is Token[], idx is number — cast to access attrSet
    const tokenArr = tokens as Array<{ attrSet: (name: string, value: string) => void }>
    const tokenIdx = idx as number
    const token = tokenArr[tokenIdx]
    if (token) {
      token.attrSet('target', '_blank')
      token.attrSet('rel', 'noopener noreferrer')
    }
    if (defaultRender) {
      return defaultRender(...args)
    }
    // Fallback: call self.renderToken(tokens, idx, options)
    const self = args[4] as { renderToken: (...a: unknown[]) => string }
    return self.renderToken(tokens, idx, args[2])
  }

  // Render images with lazy loading and safe inline constraints
  instance.renderer.rules.image = function (tokens: unknown[], idx: number): string {
    const tokenArr = tokens as Array<{ attrGet: (name: string) => string | null; content: string }>
    const token = tokenArr[idx]
    const src = token?.attrGet('src') ?? ''
    const alt = token?.content ?? ''
    return `<img src="${src}" alt="${alt}" loading="lazy" style="max-width:100%;border-radius:6px;margin:4px 0">`
  }

  md = instance
  purify = dompurifyModule.default
}

const PURIFY_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del',
    'a', 'img', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'loading', 'width', 'height', 'style']
}

export function useMarkdown(): { renderMarkdown: (raw: string) => string } {
  // Eagerly start loading both libraries on the client
  if (import.meta.client && !initPromise) {
    initPromise = init()
  }

  function renderMarkdown(raw: string): string {
    if (!raw) return ''

    // If libraries have not loaded yet, return escaped plain text
    if (!md) return escapeHtml(raw)

    const rendered = md.render(raw)

    if (!purify) return rendered

    return purify.sanitize(rendered, PURIFY_CONFIG) as string
  }

  return { renderMarkdown }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
