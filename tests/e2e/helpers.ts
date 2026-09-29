import { expect, type Page } from '@playwright/test'

/** One URL per page of the app, with real slugs so every page renders with data. */
export const ROUTES = [
  '/',
  '/overview',
  '/map',
  '/countries',
  '/country/bangladesh',
  '/regions',
  '/region/south-asia',
  '/compare?countries=BGD,IND,PAK',
  '/gaps',
  '/digital',
  '/correlation',
  '/trends',
  '/forecast',
  '/rankings',
  '/insights',
  '/index-lab',
  '/microfinance',
  '/focus/kenya',
  '/story',
  '/analyst',
  '/explorer',
  '/about',
  '/design',
] as const

/**
 * Collects uncaught page errors, console errors and failed same-origin requests so a test can
 * assert that a page loaded cleanly.
 */
export function watchForProblems(page: Page) {
  const problems: string[] = []
  const origin = () => new URL(page.url() || 'http://localhost').origin
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(origin()))
      problems.push(`HTTP ${r.status()}: ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    // Navigating away aborts in-flight requests; that is not a failure.
    if (r.failure()?.errorText !== 'net::ERR_ABORTED') problems.push(`request failed: ${r.url()}`)
  })
  return problems
}

/** Waits until the page heading is shown and loading skeletons have gone. */
export async function waitForPage(page: Page) {
  await expect(page.locator('main h1').first()).toBeVisible()
  await expect(page.getByLabel('Loading page')).toHaveCount(0)
  await page.waitForLoadState('networkidle')
}
