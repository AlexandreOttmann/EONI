/**
 * Playwright global setup — authenticates as a test merchant and saves the
 * browser storage state so all tests can reuse the session.
 *
 * Requires:
 *   PLAYWRIGHT_TEST_EMAIL    — email of a pre-seeded test merchant account
 *   PLAYWRIGHT_TEST_PASSWORD — password for that account
 *
 * If either env var is absent the setup writes an empty storage state so tests
 * still compile; tests that require real auth should skip themselves when the
 * storageState has no cookies (see skipIfUnauthenticated in fixtures/auth.ts).
 */
import { test as setup, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD

  if (!email || !password) {
    // Write an empty state so the chromium project can still start
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  await page.goto('/auth/login')
  // Wait for full Vue hydration — the form is SSR-rendered but v-model only
  // works after the client-side Vue instance has mounted.
  await page.waitForLoadState('networkidle')
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 10_000 })

  // Use type() so Vue's v-model receives individual keystrokes and updates state.
  // fill() bypasses the input event chain and leaves the reactive model empty.
  await page.locator('input[placeholder="you@company.com"]').click()
  await page.locator('input[placeholder="you@company.com"]').type(email)
  await page.locator('input[placeholder="Your password"]').click()
  await page.locator('input[placeholder="Your password"]').type(password)

  // Button becomes enabled once both fields have values
  const submitBtn = page.getByRole('button', { name: /sign in/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })

  await submitBtn.click()

  // The login sets the Supabase auth cookie and calls navigateTo('/dashboard').
  // In some cases the Nuxt client-side navigation is delayed while the auth
  // state change propagates. Wait up to 20s; if the app doesn't redirect on its
  // own, navigate programmatically (the cookie is already set at this point).
  try {
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  } catch {
    // Auth cookie was set (seen in debug runs) but navigateTo stalled.
    // Navigate manually — the middleware will let us through because the
    // cookie is present.
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard**', { timeout: 10_000 })
  }
  await expect(page.getByText(/overview/i).first()).toBeVisible({ timeout: 10_000 })

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: AUTH_FILE })
})
