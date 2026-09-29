import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { waitForPage } from './helpers'

/*
 * Key user journeys. Expected numbers are published Global Findex 2025 values (rounded to one
 * decimal as the app displays them), so these tests also catch data or formatting regressions.
 */

test('search finds a country and opens its profile', async ({ page }) => {
  await page.goto('/')
  await waitForPage(page)
  await page.getByRole('button', { name: 'Search FinLens' }).click()
  await page.getByPlaceholder(/Search pages, countries/).fill('Bangladesh')
  await page
    .getByRole('option', { name: /Bangladesh/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/country\/bangladesh/)
  await expect(page.locator('main h1')).toHaveText('Bangladesh')
})

test('country profile shows the published 2024 account ownership', async ({ page }) => {
  await page.goto('/country/bangladesh')
  await waitForPage(page)
  // Findex 2025, account.t.d, Bangladesh 2024 = 43.28 %
  await expect(page.getByText('43.3%').first()).toBeVisible()
})

test('comparison state lives in the URL', async ({ page }) => {
  await page.goto('/compare?countries=GHA,SEN')
  await waitForPage(page)
  await expect(page.getByText('Ghana').first()).toBeVisible()
  await expect(page.getByText('Senegal').first()).toBeVisible()
  await page.reload()
  await waitForPage(page)
  await expect(page).toHaveURL(/countries=GHA,SEN/)
})

test('AI Analyst answers from the data and lists its sources', async ({ page }) => {
  await page.goto('/analyst')
  await waitForPage(page)
  const box = page.getByLabel('Your question')
  await box.fill('Compare Ghana and Senegal')
  await box.press('Enter')
  // Findex 2025: Ghana 81.2 %, Senegal 76.5 % (account ownership, 2024)
  await expect(page.getByText(/81\.2%/).first()).toBeVisible()
  await expect(page.getByText(/76\.5%/).first()).toBeVisible()
  await expect(page.getByText(/Sources/).first()).toBeVisible()
})

test('Data Explorer downloads a CSV with the citation', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Download behaviour is identical; run once.')
  await page.goto('/explorer?codes=BGD,KEN&waves=2021,2024')
  await waitForPage(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /CSV/ }).first().click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^finlens-.*\.csv$/)
  const text = await readFile((await download.path())!, 'utf8')
  expect(text).toContain('economy_code')
  expect(text).toContain('BGD')
  expect(text).toContain('World Bank')
  expect(text).toContain('43.28') // full precision, not the rounded display value
})

test('deep links to inner pages work on first load', async ({ page }) => {
  await page.goto('/region/south-asia')
  await waitForPage(page)
  await expect(page.locator('main h1')).toHaveText('South Asia')
})

test('dark mode can be switched on and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/about')
  await waitForPage(page)
  await page.getByRole('button', { name: /Change theme/ }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await waitForPage(page)
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('mobile menu opens and navigates', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'The drawer is only used on small screens.')
  await page.goto('/')
  await waitForPage(page)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Forecast' }).click()
  await expect(page).toHaveURL(/\/forecast/)
  await expect(page.locator('main h1')).toHaveText('Forecast')
})

test('page snapshot exports as PNG under the production security policy', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Export menu is in the top bar on larger screens.')
  const response = await page.goto('/country/kenya')
  // Local preview serves the same headers as production (see vite.config.ts).
  if (!process.env.E2E_BASE_URL || process.env.E2E_EXPECT_HEADERS)
    expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await waitForPage(page)
  const blocked: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) blocked.push(m.text())
  })
  await page.getByRole('button', { name: 'Export and share' }).first().click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Snapshot of this view/ }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  expect(blocked).toEqual([])
})
