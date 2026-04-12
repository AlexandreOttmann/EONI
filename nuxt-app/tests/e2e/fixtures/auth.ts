import { type Page, type APIRequestContext } from '@playwright/test'

// Fake JWT payload for a test merchant.
// The token is NOT cryptographically valid — the Supabase client will try
// to verify it against the Supabase API, which we intercept below.
const FAKE_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiJ0ZXN0LW1lcmNoYW50LWlkIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9' +
  '.fake-signature'

const FAKE_USER = {
  id: 'test-merchant-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2025-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2025-01-01T00:00:00Z',
  last_sign_in_at: '2025-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

const FAKE_SESSION = {
  access_token: FAKE_ACCESS_TOKEN,
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: FAKE_USER,
}

/**
 * Inject a fake Supabase session so that useSupabaseUser() returns a
 * non-null value, bypassing the auth middleware redirect.
 *
 * Strategy:
 * 1. Set the Supabase auth cookie that @nuxtjs/supabase reads on the server
 *    side during SSR — this is the `sb-access-token` and `sb-refresh-token`
 *    cookies. The middleware calls serverSupabaseUser() which extracts the JWT
 *    from cookies; we also need to intercept the Supabase API call that
 *    validates the token.
 * 2. Intercept all Supabase auth REST API calls so getUser() succeeds.
 *
 * Must be called before page.goto().
 */
export async function injectFakeSession(page: Page): Promise<void> {
  // The @nuxtjs/supabase module reads the access token from cookies named
  // 'sb-access-token' and 'sb-refresh-token' (set by the Supabase SSR helper).
  // We set these before navigation so the SSR middleware can read them.
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const hostname = new URL(baseURL).hostname

  await page.context().addCookies([
    {
      name: 'sb-access-token',
      value: FAKE_ACCESS_TOKEN,
      domain: hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'sb-refresh-token',
      value: 'fake-refresh-token',
      domain: hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  // Also intercept all Supabase auth REST API calls so client-side
  // token validation and getUser() calls succeed.
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_SESSION),
      })
      return
    }

    if (url.includes('/auth/v1/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION),
    })
  })

  // Pre-populate localStorage so client-side hydration finds the session
  await page.addInitScript((session) => {
    const sessionJson = JSON.stringify(session)
    try {
      // Common @supabase/ssr localStorage key patterns
      localStorage.setItem('sb-localhost-auth-token', sessionJson)
      localStorage.setItem('sb--auth-token', sessionJson)
    } catch {
      // localStorage may be blocked in some contexts — ignore
    }
  }, FAKE_SESSION)
}

/**
 * Log in as the test merchant using the real login flow.
 * Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD env vars.
 * Falls back to injectFakeSession() for offline / CI runs.
 */
export async function loginAsMerchant(page: Page): Promise<void> {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (email && password) {
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  } else {
    await injectFakeSession(page)
  }
}

/**
 * Push a single record to an index via the server API using the Playwright
 * request context (carries the authenticated session cookie).
 */
export async function pushRecord(
  request: APIRequestContext,
  indexName: string,
  objectId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await request.put(
    `/api/indexes/${encodeURIComponent(indexName)}/records/${encodeURIComponent(objectId)}`,
    { data: { fields } }
  )
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`pushRecord failed ${res.status()}: ${body}`)
  }
}
