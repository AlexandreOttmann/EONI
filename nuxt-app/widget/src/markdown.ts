/**
 * Minimal markdown-to-DOM renderer.
 * Returns a DocumentFragment built entirely with createElement/createTextNode.
 * No innerHTML, no external dependencies, zero XSS risk.
 *
 * Supported syntax:
 *   **bold** / __bold__   → <strong>
 *   *italic* / _italic_   → <em>
 *   `inline code`         → <code>
 *   ![alt](url)           → <img> (https only)
 *   [label](url)          → <a> (http/https only)
 *   https://...           → <a> (bare URL autolink)
 *   ```...```             → <pre><code>
 *   - item / * item       → <ul><li>
 *   1. item               → <ol><li>
 *   # / ## / ###          → <h1> / <h2> / <h3>
 *   ---                   → <hr>
 *   | col | col |         → <table>
 *   \n\n                  → paragraph break
 *   \n (inside paragraph) → <br>
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'autolink'; href: string }
  | { kind: 'image'; alt: string; src: string }

// ── Inline parser ─────────────────────────────────────────────────────────────

/**
 * Parse a single line of text into inline tokens.
 * Priority order:
 *   1. ![alt](src)  — image (must precede link so leading ! is consumed)
 *   2. [label](url) — markdown link
 *   3. https?://…   — bare URL autolink
 *   4. `…`          — inline code
 *   5. **…** / __…__ — bold
 *   6. *…* / _…_    — italic
 */
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []

  // Bare URL: allows dots/commas inside path but not as trailing character.
  // Groups: [1]=full image, [2]=alt, [3]=src, [4]=full link, [5]=label, [6]=href,
  //         [7]=bare URL, [8]=inline code, [9]=bold/italic span
  const pattern = /(!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<>"')\].,!?]+(?:[.,!?][^\s<>"')\].,!?]+)*)|`[^`]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?<!\*)\*(?!\*)[\s\S]+?(?<!\*)\*(?!\*)|(?<!_)_(?!_)[\s\S]+?(?<!_)_(?!_))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }

    const raw = match[0]

    if (raw.startsWith('![')) {
      // Image: ![alt](src) — src already validated https?:// by the regex
      tokens.push({ kind: 'image', alt: match[2] ?? '', src: match[3] ?? '' })
    } else if (raw.startsWith('[')) {
      // Markdown link: [label](href)
      const label = match[4] ?? ''
      const href = match[5] ?? ''
      tokens.push({ kind: 'link', label, href })
    } else if (match[6] !== undefined) {
      // Bare URL autolink
      tokens.push({ kind: 'autolink', href: match[6] })
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ kind: 'code', value: raw.slice(1, -1) })
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ kind: 'bold', value: raw.slice(2, -2) })
    } else if (raw.startsWith('__') && raw.endsWith('__')) {
      tokens.push({ kind: 'bold', value: raw.slice(2, -2) })
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ kind: 'italic', value: raw.slice(1, -1) })
    } else if (raw.startsWith('_') && raw.endsWith('_')) {
      tokens.push({ kind: 'italic', value: raw.slice(1, -1) })
    } else {
      // Fallback: treat as plain text
      tokens.push({ kind: 'text', value: raw })
    }

    lastIndex = pattern.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) })
  }

  return tokens
}

/**
 * Render inline tokens into DOM nodes appended to the given parent.
 * Handles \n inside a segment as <br>.
 */
function appendInlineTokens(parent: Node, tokens: InlineToken[]): void {
  for (const token of tokens) {
    if (token.kind === 'code') {
      const code = document.createElement('code')
      code.textContent = token.value
      parent.appendChild(code)
    } else if (token.kind === 'bold') {
      const strong = document.createElement('strong')
      // Recurse: bold content may itself contain italic/code
      appendInlineTokens(strong, parseInline(token.value))
      parent.appendChild(strong)
    } else if (token.kind === 'italic') {
      const em = document.createElement('em')
      appendInlineTokens(em, parseInline(token.value))
      parent.appendChild(em)
    } else if (token.kind === 'link') {
      // Only allow http/https — never javascript: or data:
      const href =
        token.href.startsWith('http://') || token.href.startsWith('https://')
          ? token.href
          : '#'
      const a = document.createElement('a')
      a.href = href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = token.label // textContent, not innerHTML — safe
      parent.appendChild(a)
    } else if (token.kind === 'autolink') {
      // Bare URL — href is already https?:// validated by the regex
      const a = document.createElement('a')
      a.href = token.href
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.textContent = token.href
      parent.appendChild(a)
    } else if (token.kind === 'image') {
      // Image — src is already https?:// validated by the regex
      const img = document.createElement('img')
      img.alt = token.alt
      img.src = token.src
      img.loading = 'lazy'
      parent.appendChild(img)
    } else {
      // Plain text — split on \n to insert <br>
      const parts = token.value.split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > 0) {
          parent.appendChild(document.createTextNode(parts[i]))
        }
        if (i < parts.length - 1) {
          parent.appendChild(document.createElement('br'))
        }
      }
    }
  }
}

// ── Block parsers ─────────────────────────────────────────────────────────────

/**
 * Detect if the lines form a markdown table.
 * Requires at least 2 lines, every line containing '|',
 * and the second line being the separator row.
 */
function isTableBlock(lines: string[]): boolean {
  if (lines.length < 2) return false
  return lines.every((l) => l.includes('|')) && /^\|[\s\-:|]+\|/.test(lines[1])
}

function buildTable(lines: string[]): HTMLTableElement {
  const parseRow = (line: string): string[] =>
    line.split('|').slice(1, -1).map((cell) => cell.trim())

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const tbody = document.createElement('tbody')

  // Header row (line 0)
  const headerRow = document.createElement('tr')
  for (const cell of parseRow(lines[0])) {
    const th = document.createElement('th')
    appendInlineTokens(th, parseInline(cell))
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Data rows (lines 2+, skip separator line 1)
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue
    const tr = document.createElement('tr')
    for (const cell of parseRow(lines[i])) {
      const td = document.createElement('td')
      appendInlineTokens(td, parseInline(cell))
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  return table
}

/**
 * Detect if all non-empty lines in a paragraph start with "- " or "* " (unordered)
 * or "N. " (ordered).
 */
function detectListType(lines: string[]): 'ul' | 'ol' | null {
  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length === 0) return null

  const allUnordered = nonEmpty.every((l) => /^[\-\*] /.test(l.trimStart()))
  if (allUnordered) return 'ul'

  const allOrdered = nonEmpty.every((l) => /^\d+\. /.test(l.trimStart()))
  if (allOrdered) return 'ol'

  return null
}

function buildList(listType: 'ul' | 'ol', lines: string[]): HTMLElement {
  const list = document.createElement(listType)
  for (const line of lines) {
    const trimmed = line.trimStart()
    if (trimmed.length === 0) continue

    // Strip the leading marker: "- ", "* ", or "1. "
    let content: string
    if (listType === 'ul') {
      content = trimmed.replace(/^[\-\*] /, '')
    } else {
      content = trimmed.replace(/^\d+\. /, '')
    }

    const li = document.createElement('li')
    appendInlineTokens(li, parseInline(content))
    list.appendChild(li)
  }
  return list
}

/**
 * Build a heading element (h1–h3) from a line starting with #.
 */
function buildHeading(line: string): HTMLElement {
  const match = line.match(/^(#{1,3}) (.+)/)
  if (!match) return buildParagraph(line)
  const level = match[1].length as 1 | 2 | 3
  const tag = `h${level}` as 'h1' | 'h2' | 'h3'
  const el = document.createElement(tag)
  appendInlineTokens(el, parseInline(match[2]))
  return el
}

function buildParagraph(text: string): HTMLElement {
  const p = document.createElement('p')
  appendInlineTokens(p, parseInline(text))
  return p
}

// ── Code fence splitter ───────────────────────────────────────────────────────

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'fence'; value: string; lang: string }

/**
 * Split the full text on ```...``` fences.
 * Returns alternating text and fence segments.
 */
function splitFences(text: string): Segment[] {
  const segments: Segment[] = []
  // Match opening ``` with optional language identifier, then content, then closing ```
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({
      kind: 'fence',
      lang: match[1].trim(),
      value: match[2],
    })
    lastIndex = fencePattern.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Render markdown text into a DocumentFragment.
 * Safe: builds DOM only with createElement/createTextNode, never innerHTML.
 */
export function renderMarkdown(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment()

  const segments = splitFences(text)

  for (const segment of segments) {
    if (segment.kind === 'fence') {
      // Code block
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      // Strip trailing newline left by the fence capture group
      code.textContent = segment.value.replace(/\n$/, '')
      pre.appendChild(code)
      fragment.appendChild(pre)
      continue
    }

    // Plain text segment — process line by line so headings and HRs are
    // always detected regardless of surrounding blank lines.
    const normalized = segment.value.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '')
    if (normalized.length === 0) continue

    const lines = normalized.split('\n')
    // Accumulated lines that form the current block (paragraph or list)
    let block: string[] = []

    function flushBlock(): void {
      if (block.length === 0) return
      const blockLines = block
      block = []
      // Table: every line contains '|' and line[1] is a separator row
      if (isTableBlock(blockLines)) {
        fragment.appendChild(buildTable(blockLines))
        return
      }
      // List
      const listType = detectListType(blockLines)
      if (listType !== null) {
        fragment.appendChild(buildList(listType, blockLines))
        return
      }
      // Default: join as paragraph (single \n inside → <br> via appendInlineTokens)
      fragment.appendChild(buildParagraph(blockLines.join('\n')))
    }

    for (const line of lines) {
      // Blank line → flush current block (paragraph break)
      if (line.trim() === '') {
        flushBlock()
        continue
      }

      // Heading line — always its own block regardless of context
      if (/^#{1,3} /.test(line)) {
        flushBlock()
        fragment.appendChild(buildHeading(line))
        continue
      }

      // Horizontal rule — always its own block
      if (/^[-*_]{3,}$/.test(line.trim())) {
        flushBlock()
        fragment.appendChild(document.createElement('hr'))
        continue
      }

      block.push(line)
    }

    // Flush any remaining accumulated lines
    flushBlock()
  }

  return fragment
}
