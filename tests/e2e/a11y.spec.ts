import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { ROUTES, waitForPage } from './helpers'

/**
 * Automated WCAG 2.1 A/AA checks with axe-core on every page, in light and dark themes.
 * Serious and critical violations fail the test; minor ones are reported in the output.
 * Automated checks find roughly a third of accessibility issues — they do not replace testing
 * with a keyboard and a screen reader.
 */
for (const theme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`${theme}: ${route} has no serious accessibility violations`, async ({ page }, info) => {
      test.skip(
        info.project.name === 'mobile' && theme === 'dark',
        'Dark theme checked on desktop.',
      )
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(route)
      await waitForPage(page)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      const report = serious
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.help}\n` +
            v.nodes
              .slice(0, 5)
              .map((n) => `   ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1] ?? ''}`)
              .join('\n'),
        )
        .join('\n')
      expect(
        serious.map((v) => v.id),
        report,
      ).toEqual([])
    })
  }
}
