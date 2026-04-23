/**
 * Pure helpers for working with URLs and brand domains.
 *
 * These are used by the crawl API routes to enforce the
 * "1 brand = 1 primary domain" invariant at write-time.
 *
 * No side effects, no dependencies, unit-testable.
 */

export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`Invalid URL: ${input}`)
    this.name = 'InvalidUrlError'
  }
}

/**
 * Parse a URL and return its root hostname, stripped of a leading `www.`.
 *
 * This is a minimal MVP implementation — it does NOT do true registrable-domain
 * extraction (which would require the Public Suffix List via `tldts` or similar).
 * For `acme-travel.co.uk` it returns `acme-travel.co.uk`, which is correct.
 * For `shop.acme.com` it returns `shop.acme.com`, which is intentionally stricter
 * than registrable-domain matching: a merchant crawling `shop.acme.com` must bind
 * to a brand whose domain is exactly `shop.acme.com`.
 *
 * @throws {InvalidUrlError} if `url` is not a parseable absolute URL.
 */
export function extractRootDomain(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new InvalidUrlError(url)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError(url)
  }

  const hostname = parsed.hostname.toLowerCase().trim()
  if (!hostname) throw new InvalidUrlError(url)

  return hostname.replace(/^www\./, '')
}

/**
 * Turn a domain into a reasonable brand-name suggestion.
 *
 * Examples:
 *   evaneos.com            -> Evaneos
 *   acme-travel.co.uk      -> Acme Travel
 *   shop.acme.com          -> Shop Acme
 *   my_awesome-brand.io    -> My Awesome Brand
 *
 * Strategy: strip the last TLD-ish segment (or two-part TLDs like .co.uk),
 * split remaining on `.`, `-`, `_`, and title-case each word.
 */
export function titleCaseFromDomain(domain: string): string {
  if (!domain) return ''

  const lowered = domain.toLowerCase().trim().replace(/^www\./, '')
  const parts = lowered.split('.').filter(Boolean)

  if (parts.length === 0) return ''

  // Heuristic: drop trailing TLD segment(s). Handle common two-part TLDs.
  const twoPartTlds = new Set([
    'co.uk', 'co.jp', 'co.nz', 'co.kr', 'co.in', 'co.za',
    'com.au', 'com.br', 'com.mx', 'com.sg', 'com.tr',
    'org.uk', 'net.au', 'ac.uk', 'gov.uk'
  ])

  let nameParts: string[]
  if (parts.length >= 3 && twoPartTlds.has(`${parts[parts.length - 2]}.${parts[parts.length - 1]}`)) {
    nameParts = parts.slice(0, -2)
  } else if (parts.length >= 2) {
    nameParts = parts.slice(0, -1)
  } else {
    nameParts = parts
  }

  if (nameParts.length === 0) return ''

  // Split each remaining label on hyphens/underscores and title-case words.
  const words = nameParts
    .flatMap(label => label.split(/[-_]+/))
    .map(w => w.trim())
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))

  return words.join(' ')
}
