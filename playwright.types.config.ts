import { defineConfig } from '@playwright/test';

/**
 * Type-level tests: no browser. They pack the package, install it into fixture projects
 * (standalone apps, npm/pnpm monorepos) and run real `tsc` over them under different
 * TypeScript versions, `moduleResolution`/`module` and `jsx` settings.
 *
 *   npm run test:types
 *   TYPES_REUSE_INSTALL=1 npm run test:types   # skip reinstalling fixture node_modules
 */
export default defineConfig({
  testDir: './tests/types',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/types/setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  reporter: process.env.CI ? 'dot' : 'list',
});
