import { expect, test } from '@playwright/test'
import { ROUTES, waitForPage, watchForProblems } from './helpers'

/** Every page loads without errors, failed requests or sideways scrolling. */
for (const route of ROUTES) {
  test(`loads ${route}`, async ({ page }, info) => {
    const problems = watchForProblems(page)
    await page.goto(route)
    await waitForPage(page)

    expect(problems, problems.join('\n')).toEqual([])
    await expect(page).toHaveTitle(/FinLens/)

    // No horizontal page scroll at any size (wide tables and maps scroll inside their card).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(
      overflow,
      `page is ${overflow}px wider than the ${info.project.name} viewport`,
    ).toBeLessThanOrEqual(0)
  })
}

test('unknown addresses show the 404 page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')
  await expect(page.getByText('404')).toBeVisible()
  await expect(page.locator('main h1')).toBeVisible()
})

test('an unknown country slug is handled without crashing', async ({ page }) => {
  const problems = watchForProblems(page)
  await page.goto('/country/not-a-country')
  await expect(page.locator('main h1').first()).toBeVisible()
  expect(problems.filter((p) => p.startsWith('page error'))).toEqual([])
})
