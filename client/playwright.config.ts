import { defineConfig, devices } from '@playwright/test'

// `PERF=1` switches the suite to the production build: dev-server numbers are
// not comparable with what ships. The perf spec is skipped unless PERF is set.
const perfMode = !!process.env.PERF

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: perfMode ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: perfMode
      ? 'npm run build && npx vite preview --port 4173 --strictPort'
      : 'npm run dev',
    url: perfMode ? 'http://localhost:4173' : 'http://localhost:5173',
    reuseExistingServer: !process.env.CI && !perfMode,
    timeout: perfMode ? 240_000 : 120_000,
  },
})
