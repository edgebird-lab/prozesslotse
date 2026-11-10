import { defineConfig } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    // Vorhandenen Browser nutzen statt einen herunterzuladen: lokal Edge, in der CI Chrome
    channel: CI ? 'chrome' : 'msedge',
    locale: 'de-DE',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
