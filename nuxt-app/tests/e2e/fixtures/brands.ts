/**
 * Brand-related test helpers for the Brands UX Redesign — Phase A E2E suite.
 *
 * These helpers wrap the authenticated `page.request` context so that tests
 * can seed, inspect, and tear down brands via the real server API (which
 * enforces RLS on the active session from storageState).
 */
import { type Page, type APIResponse } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

export interface Brand {
  id: string
  merchant_id: string
  name: string
  domain: string | null
  description: string | null
  logo_url: string | null
  extracted_description: string | null
  created_at: string
  updated_at: string
}

/**
 * Returns true if the saved auth state contains at least one cookie,
 * indicating a real Supabase session was captured by auth.setup.ts.
 * Tests that touch authenticated routes should skip themselves when this
 * returns false so offline / CI-without-creds runs stay green.
 */
export function hasStoredSession(): boolean {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf8')
    const state = JSON.parse(raw) as { cookies?: unknown[] }
    return Array.isArray(state.cookies) && state.cookies.length > 0
  } catch {
    return false
  }
}

/**
 * Create a brand via POST /api/brands using the page's authenticated
 * request context. The server-side Zod schema requires `domain` to be a
 * fully-qualified URL when provided — pass `{ domain: 'https://example.com' }`,
 * not `'example.com'`.
 */
export async function createBrand(
  page: Page,
  payload: { name: string, domain?: string }
): Promise<Brand> {
  const res: APIResponse = await page.request.post('/api/brands', {
    data: payload
  })
  if (!res.ok()) {
    throw new Error(`createBrand failed ${res.status()}: ${await res.text()}`)
  }
  const body = await res.json() as { brand: Brand }
  return body.brand
}

/**
 * Delete a brand via DELETE /api/brands/:id. Ignores failures so that
 * afterEach cleanup never masks the real assertion failure.
 */
export async function deleteBrandSafe(page: Page, brandId: string): Promise<void> {
  try {
    await page.request.delete(`/api/brands/${brandId}`)
  } catch {
    // swallow — cleanup is best-effort
  }
}

/**
 * Fetch the current list of brands for the authenticated merchant.
 */
export async function listBrands(page: Page): Promise<Brand[]> {
  const res = await page.request.get('/api/brands')
  if (!res.ok()) {
    throw new Error(`listBrands failed ${res.status()}: ${await res.text()}`)
  }
  const body = await res.json() as { brands: Brand[] }
  return body.brands
}

/**
 * Delete every brand whose name matches the provided prefix. Used by
 * afterAll hooks so the test merchant doesn't accumulate stale "E2E …"
 * brands across runs.
 */
export async function cleanupBrandsByPrefix(page: Page, prefix: string): Promise<void> {
  try {
    const brands = await listBrands(page)
    for (const b of brands) {
      if (b.name.startsWith(prefix)) {
        await deleteBrandSafe(page, b.id)
      }
    }
  } catch {
    // best-effort
  }
}
