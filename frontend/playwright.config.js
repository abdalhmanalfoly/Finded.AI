// Browser end-to-end tests (preview mode: sample data, no Supabase needed).
// Builds with mode=e2e so frontend/.env.e2e overrides any local Supabase values.
// Run:  npm install --no-save @playwright/test && npx playwright install chromium && npm run test:e2e
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npx vite build --mode e2e && npx vite preview --mode e2e --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
})
