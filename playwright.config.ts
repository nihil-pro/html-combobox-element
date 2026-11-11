import { defineConfig, devices } from '@playwright/test';

/**
 * The component is bundled once (tests/global-setup.ts) and served to every page through
 * request interception, so no web server is needed.
 *
 * The accessibility assertions read Chrome's own accessibility tree (over CDP), so the suite
 * runs on Chromium. Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Type-level tests have their own config (no browser): npm run test:types
  testIgnore: 'types/**',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['json', { outputFile: 'results.json' }]],
  // reporter: process.env.CI ? 'dot' : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
      },
    },
  ],
});
