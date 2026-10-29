import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: { trace: 'on-first-retry' },
  projects: [
    {
      name: 'solar',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5159' },
      testMatch: 'solar.spec.ts',
    },
  ],
  webServer: {
    command:
      'pnpm --filter @solarrechner/web exec wrangler dev --config dist/server/wrangler.json --port 5159',
    port: 5159,
    reuseExistingServer: false,
  },
});
