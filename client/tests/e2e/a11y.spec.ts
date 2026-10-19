import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const PAGES = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
  { path: '/workout', name: 'Workout' },
  { path: '/plan', name: 'Plan' },
  { path: '/progress', name: 'Progress' },
  { path: '/activities', name: 'Activities' },
  { path: '/goals', name: 'Goals' },
  { path: '/settings', name: 'Settings' },
]

for (const page of PAGES) {
  test.describe(`${page.name} page accessibility`, () => {
    test.beforeEach(async ({ page: p }) => {
      await p.goto(page.path)
      await p.waitForLoadState('networkidle')
    })

    test('should have no violations', async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })

    test('should have no color contrast violations', async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags(['cat.color']).analyze()

      expect(results.violations).toEqual([])
    })

    test('should have proper heading hierarchy', async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags(['cat.structure']).analyze()

      expect(results.violations).toEqual([])
    })

    test('should have accessible forms', async ({ page }) => {
      const results = await new AxeBuilder({ page }).withTags(['cat.forms']).analyze()

      expect(results.violations).toEqual([])
    })
  })
}

test.describe('Component-level accessibility', () => {
  test('AppDropdown keyboard navigation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find a dropdown trigger and test keyboard nav
    const trigger = page.locator('[aria-haspopup="menu"]').first()
    if (await trigger.count()) {
      await trigger.focus()
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[role="menu"]').first()).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('[role="menu"]').first()).toBeHidden()
    }
  })

  test('AppSelect keyboard navigation', async ({ page }) => {
    await page.goto('/goals')
    await page.waitForLoadState('networkidle')

    const select = page.locator('[aria-haspopup="listbox"]').first()
    if (await select.count()) {
      await select.focus()
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('[role="listbox"]').first()).toBeVisible()
      await page.keyboard.press('Escape')
    }
  })

  test('LegalModal focus trap', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Open legal modal
    await page.click('button:has-text("Privacy"), button:has-text("Terms")')
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toBeVisible()

    // Test Tab trap
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await page.keyboard.press('Tab')
    const focusedInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')
      return dialog?.contains(document.activeElement)
    })
    expect(focusedInDialog).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('ToastContainer aria-live', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const toastRegion = page.locator('[role="region"][aria-live="polite"]')
    await expect(toastRegion.first()).toHaveAttribute('aria-label', 'Notifications')
  })
})

test.describe('Analytics consent banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should have no violations', async ({ page }) => {
    await expect(page.locator('#analytics-consent')).toBeVisible()

    const results = await new AxeBuilder({ page })
      .include('#analytics-consent')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('names itself and offers both answers', async ({ page }) => {
    const banner = page.locator('#analytics-consent')
    await expect(banner).toHaveAccessibleName('ANALÍTICA')
    await expect(banner.getByRole('button', { name: 'Permitir análise' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Recusar' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Política de Privacidade' })).toBeVisible()
  })

  test('records a refusal and stops asking', async ({ page }) => {
    const banner = page.locator('#analytics-consent')
    await banner.getByRole('button', { name: 'Recusar' }).click()
    await expect(banner).toBeHidden()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#analytics-consent')).toBeHidden()
  })
})
