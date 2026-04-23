/**
 * Brands UX Redesign — Phase A
 * Drill-down navigation + overview edit + delete flows.
 *
 * Covered acceptance criteria (from .claude/plans/idempotent-strolling-willow.md):
 *   - Brand card click navigates to /dashboard/brands/{id}
 *   - All four tabs (Overview, Indexes, Crawls, Products) render without error
 *   - Empty states for Crawls and Products are surfaced for a fresh brand
 *   - Overview edit form is pre-filled and "Save changes" persists
 *   - Delete from the detail page redirects back to the list and removes the brand
 *   - Sidebar no longer exposes Indexes / Products as top-level entries
 *
 * Auth: requires PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD. When the
 * storageState has no cookies the tests skip themselves (matches push-indexing.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { cleanupBrandsByPrefix, hasStoredSession } from '../fixtures/brands'

const BRAND_PREFIX = 'E2E Drill'
const BRAND_NAME = `${BRAND_PREFIX} ${Date.now()}`

async function openCreateModalAndSubmit(page: Page, name: string): Promise<void> {
  // Multiple buttons can say "Add Brand" or "Create your first brand" depending on
  // whether the grid already has content. Match either.
  const addBtn = page.getByRole('button', { name: /add brand|create your first brand/i }).first()
  await addBtn.click()

  // Modal is open
  const nameInput = page.locator('#brand-name')
  await expect(nameInput).toBeVisible({ timeout: 5_000 })

  await nameInput.click()
  await nameInput.pressSequentially(name, { delay: 15 })

  // Submit — the "Create" button inside the modal dialog
  await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click()

  // Modal closes and card appears in the grid
  await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible({ timeout: 10_000 })
}

test.describe('Brands — drill-down navigation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!hasStoredSession()) {
      testInfo.skip(
        true,
        'No Supabase test credentials. Set PLAYWRIGHT_TEST_EMAIL / PLAYWRIGHT_TEST_PASSWORD to run these tests.'
      )
      return
    }
    await page.goto('/dashboard/brands')
    await page.waitForLoadState('networkidle')
  })

  test.afterAll(async ({ browser }) => {
    if (!hasStoredSession()) return
    const ctx = await browser.newContext({ storageState: 'tests/e2e/.auth/user.json' })
    const page = await ctx.newPage()
    await cleanupBrandsByPrefix(page, BRAND_PREFIX)
    await ctx.close()
  })

  test('creates a brand and drills into the detail page with all four tabs', async ({ page }) => {
    await openCreateModalAndSubmit(page, BRAND_NAME)

    // Click the brand card — it's the UCard with role=button and aria-label="Open …"
    const card = page.getByRole('button', { name: `Open ${BRAND_NAME}` })
    await expect(card).toBeVisible()
    await card.click()

    // URL changes to /dashboard/brands/{uuid}
    await page.waitForURL(/\/dashboard\/brands\/[0-9a-f-]{36}/, { timeout: 10_000 })

    // Overview tab is active by default — name as the h1, edit form pre-filled
    await expect(page.getByRole('heading', { name: BRAND_NAME, level: 1 })).toBeVisible()
    await expect(page.locator('#brand-edit-name')).toHaveValue(BRAND_NAME)

    // Indexes tab — grid or empty state renders without throwing
    await page.getByRole('tab', { name: /indexes/i }).click()
    // Either the "No indexes yet." empty state, OR the index grid — both acceptable
    const indexesEmpty = page.getByText('No indexes yet.')
    const indexesGrid = page.locator('[href^="/dashboard/indexes/"]').first()
    await expect(indexesEmpty.or(indexesGrid)).toBeVisible({ timeout: 10_000 })

    // Crawls tab — new brand has no crawls yet
    await page.getByRole('tab', { name: /crawls/i }).click()
    await expect(page.getByText('No crawls for this brand yet.')).toBeVisible({ timeout: 10_000 })

    // Products tab — new brand has no products yet
    await page.getByRole('tab', { name: /products/i }).click()
    await expect(page.getByText('No products for this brand yet.')).toBeVisible({ timeout: 10_000 })

    // Back arrow returns to list
    await page.getByRole('link', { name: /back to brands/i }).click()
    await page.waitForURL(/\/dashboard\/brands$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Brands', level: 1 })).toBeVisible()

    // A11y — exclude known pre-existing sidebar issues tracked separately
    const a11y = await new AxeBuilder({ page })
      .disableRules(['color-contrast', 'heading-order'])
      .analyze()
    expect(a11y.violations).toEqual([])
  })

  test('edits description from overview then deletes the brand', async ({ page }) => {
    const uniqueName = `${BRAND_PREFIX} Edit ${Date.now()}`
    await openCreateModalAndSubmit(page, uniqueName)

    await page.getByRole('button', { name: `Open ${uniqueName}` }).click()
    await page.waitForURL(/\/dashboard\/brands\/[0-9a-f-]{36}/, { timeout: 10_000 })

    // Change description — textarea has label "Description"
    const description = page.locator('#brand-edit-description')
    await expect(description).toBeVisible()
    const newDescription = `Updated by E2E at ${Date.now()}`
    await description.click()
    await description.pressSequentially(newDescription, { delay: 10 })

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click()

    // Composable toast — "Brand updated" success toast appears
    await expect(page.getByText(/brand updated/i).first()).toBeVisible({ timeout: 10_000 })

    // Field still shows the new value after the refresh
    await expect(description).toHaveValue(new RegExp(`Updated by E2E`))

    // Delete brand — opens confirm modal, then confirm
    await page.getByRole('button', { name: /delete brand/i }).first().click()
    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /delete brand/i })
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Redirected back to list
    await page.waitForURL(/\/dashboard\/brands$/, { timeout: 10_000 })

    // Brand card is gone from the list
    await expect(page.getByRole('button', { name: `Open ${uniqueName}` })).toHaveCount(0)
  })

  test('sidebar does not expose Indexes or Products as top-level nav items', async ({ page }) => {
    // Sidebar nav is labelled "Dashboard navigation" via aria-label
    const nav = page.getByRole('navigation', { name: /dashboard navigation/i })
    await expect(nav).toBeVisible()

    // Brands is still present
    await expect(nav.getByRole('link', { name: /^brands$/i })).toBeVisible()

    // Indexes and Products must NOT appear as top-level nav links
    await expect(nav.getByRole('link', { name: /^indexes$/i })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /^products$/i })).toHaveCount(0)
  })
})
