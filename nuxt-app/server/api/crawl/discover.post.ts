import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { consola } from 'consola'
import type { DiscoverResponse, SitemapGroup } from '~/types/api'
import { extractRootDomain, titleCaseFromDomain, InvalidUrlError } from '../../utils/domain'

const bodySchema = z.object({
  url: z.string().url().refine(u => /^https?:\/\//i.test(u), 'URL must use http or https'),
  brand_id: z.string().uuid().optional()
})

/**
 * Extract all <loc> URLs from a sitemap XML string.
 * Works for both regular sitemaps and sitemap index files.
 */
function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi
  let match
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) locs.push(match[1])
  }
  return locs
}

/**
 * Check if a sitemap XML is a sitemap index (contains <sitemapindex>).
 */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml)
}

/**
 * Try to fetch a URL, return the text body or null on failure.
 */
async function safeFetch(url: string): Promise<string | null> {
  try {
    const response = await $fetch<string>(url, {
      headers: { 'User-Agent': 'EcommerceAISaaS-Crawler/1.0' },
      responseType: 'text',
      timeout: 10_000
    })
    return response
  } catch {
    return null
  }
}

/**
 * Try to find the sitemap URL from robots.txt.
 */
function extractSitemapFromRobots(robotsTxt: string): string | null {
  const match = robotsTxt.match(/^Sitemap:\s*(.+)$/im)
  return match?.[1]?.trim() ?? null
}

/**
 * Collect all page URLs from a sitemap, handling sitemap index files.
 * Returns urls and the canonical origin derived from the sitemap itself
 * (which may differ from the user-input origin, e.g. www vs non-www).
 */
async function collectSitemapUrls(origin: string): Promise<{ urls: string[], found: boolean, canonicalOrigin: string }> {
  // 1. Try /sitemap.xml
  let xml = await safeFetch(`${origin}/sitemap.xml`)

  // 2. Try /sitemap_index.xml
  if (!xml) {
    xml = await safeFetch(`${origin}/sitemap_index.xml`)
  }

  // 3. Check robots.txt for Sitemap: directive
  if (!xml) {
    const robots = await safeFetch(`${origin}/robots.txt`)
    if (robots) {
      const sitemapUrl = extractSitemapFromRobots(robots)
      if (sitemapUrl) {
        xml = await safeFetch(sitemapUrl)
      }
    }
  }

  if (!xml) return { urls: [], found: false, canonicalOrigin: origin }

  // Handle sitemap index: fetch all child sitemaps in parallel.
  // safeFetch already has a 10s timeout per request so no cap needed.
  if (isSitemapIndex(xml)) {
    const childUrls = extractLocs(xml)
    const childResults = await Promise.all(
      childUrls.map(async (u) => {
        const childXml = await safeFetch(u)
        return childXml && !isSitemapIndex(childXml) ? extractLocs(childXml) : []
      })
    )
    const allUrls: string[] = []
    for (const urls of childResults) allUrls.push(...urls)

    // Derive canonical origin from sitemap content (handles www vs non-www)
    const canonicalOrigin = allUrls.length > 0 ? new URL(allUrls[0]!).origin : origin
    return { urls: allUrls, found: true, canonicalOrigin }
  }

  const urls = extractLocs(xml)
  const canonicalOrigin = urls.length > 0 ? new URL(urls[0]!).origin : origin
  return { urls, found: true, canonicalOrigin }
}

/**
 * Group URLs by their first path segment.
 * e.g., /voyages/japan → group "voyages", /blog/post-1 → group "blog"
 * Root-level slugs (e.g., /about) go into "ungrouped".
 */
function groupUrlsByPath(urls: string[], origin: string): { groups: SitemapGroup[], ungroupedCount: number } {
  const groupMap = new Map<string, string[]>()
  let ungroupedCount = 0

  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl)
      // Skip URLs from different origins
      if (url.origin !== origin) continue

      const segments = url.pathname.split('/').filter(Boolean)

      if (segments.length >= 2) {
        // Has a directory prefix: /voyages/foo → group "voyages"
        const prefix = segments[0]!
        const existing = groupMap.get(prefix) ?? []
        existing.push(rawUrl)
        groupMap.set(prefix, existing)
      } else {
        // Root-level: / or /about
        ungroupedCount++
      }
    } catch {
      // Skip malformed URLs
    }
  }

  const groups: SitemapGroup[] = Array.from(groupMap.entries())
    .map(([prefix, groupUrls]) => ({
      pattern: `/${prefix}/**`,
      label: prefix,
      count: groupUrls.length,
      sample_urls: groupUrls.slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count)

  return { groups, ungroupedCount }
}

export default defineEventHandler(async (event): Promise<DiscoverResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readValidatedBody(event, bodySchema.parse)

  // Brand-domain guard: reject early if the URL's root domain isn't in the
  // selected brand's `domains` array. Skip entirely when no brand_id is given.
  if (body.brand_id) {
    const client = await serverSupabaseServiceRole(event)
    const { data: brand } = await client
      .from('brands')
      .select('id, name, domains')
      .eq('id', body.brand_id)
      .eq('merchant_id', user.sub) // multi-tenancy filter — do not remove
      .maybeSingle()

    if (!brand) throw createError({ statusCode: 404, message: 'Brand not found' })

    let crawlDomain: string
    try {
      crawlDomain = extractRootDomain(body.url)
    } catch (err) {
      if (err instanceof InvalidUrlError) {
        throw createError({ statusCode: 400, message: 'Invalid URL' })
      }
      throw err
    }

    const brandDomains: string[] = Array.isArray(brand.domains) ? brand.domains : []

    // Discover is read-only — no auto-claim. Empty domains pass through, so
    // a not-yet-bound brand can still run discover. Once the brand has any
    // domain(s), crawl domain must be a member.
    if (brandDomains.length > 0 && !brandDomains.includes(crawlDomain)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'brand_domain_mismatch',
        data: {
          code: 'brand_domain_mismatch',
          brand_id: body.brand_id,
          brand_domain: brandDomains[0] ?? '',
          crawl_domain: crawlDomain,
          message: `This URL belongs to ${crawlDomain} but the selected brand "${brand.name}" is bound to ${brandDomains.join(', ')}. Create a new brand for ${crawlDomain}, or switch the active brand.`,
          suggested_brand_name: titleCaseFromDomain(crawlDomain)
        }
      })
    }
  }

  const origin = new URL(body.url).origin

  consola.info({ tag: 'crawl-discover', origin, merchantId: user.sub })

  const { urls, found, canonicalOrigin } = await collectSitemapUrls(origin)

  if (!found || urls.length === 0) {
    return {
      sitemap_found: false,
      total_urls: 0,
      groups: [],
      ungrouped_count: 0
    }
  }

  const { groups, ungroupedCount } = groupUrlsByPath(urls, canonicalOrigin)

  consola.info({
    tag: 'crawl-discover',
    origin,
    total_urls: urls.length,
    groups_found: groups.length,
    ungrouped: ungroupedCount
  })

  return {
    sitemap_found: true,
    total_urls: urls.length,
    groups,
    ungrouped_count: ungroupedCount
  }
})
