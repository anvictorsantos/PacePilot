// Web-vitals budgets, PERF=1 only: the numbers are meaningful against `vite
// preview`, never the dev server. Public routes only; INP stays with field data.
import { test, expect } from '@playwright/test'

const BUDGETS = { lcp: 2500, cls: 0.1, fcp: 1800, ttfb: 800 }

const PAGES = [
  { path: '/', name: 'Landing' },
  { path: '/login', name: 'Login' },
]

type Vitals = { lcp: number; cls: number; fcp: number; ttfb: number }

test.describe('Web vitals budgets', () => {
  test.skip(!process.env.PERF, 'run with `npm run perf:e2e` against the production build')

  for (const page of PAGES) {
    test(`${page.name} stays inside the budgets`, async ({ page: p }) => {
      await p.addInitScript(() => {
        const vitals = { lcp: 0, cls: 0, fcp: 0, ttfb: 0 }
        Object.defineProperty(window, '__vitals', { value: vitals, writable: false })

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') vitals.fcp = entry.startTime
          }
        }).observe({ type: 'paint', buffered: true })

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            vitals.lcp = entry.startTime
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true })

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
            if (!shift.hadRecentInput) vitals.cls += shift.value
          }
        }).observe({ type: 'layout-shift', buffered: true })

        const navigation = performance.getEntriesByType('navigation')[0] as
          PerformanceNavigationTiming | undefined
        vitals.ttfb = navigation?.responseStart ?? 0
      })

      await p.goto(page.path)
      await p.waitForLoadState('networkidle')
      // LCP is only final once the page settles; CLS accumulates over the same window.
      await p.waitForTimeout(1000)

      const vitals = await p.evaluate(() => (window as unknown as { __vitals: Vitals }).__vitals)

      expect(vitals.lcp, `LCP ${Math.round(vitals.lcp)}ms`).toBeLessThanOrEqual(BUDGETS.lcp)
      expect(vitals.cls, `CLS ${vitals.cls.toFixed(3)}`).toBeLessThanOrEqual(BUDGETS.cls)
      expect(vitals.fcp, `FCP ${Math.round(vitals.fcp)}ms`).toBeLessThanOrEqual(BUDGETS.fcp)
      expect(vitals.ttfb, `TTFB ${Math.round(vitals.ttfb)}ms`).toBeLessThanOrEqual(BUDGETS.ttfb)
    })
  }
})
