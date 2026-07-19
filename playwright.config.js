// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * Workers are capped deliberately (not maxed out) because this framework
 * runs against the PUBLIC OrangeHRM demo instance, which is shared by
 * everyone testing it. Hammering it with full parallelism causes throttling
 * and flaky failures that have nothing to do with the app itself — the demo
 * has been observed returning slow/degraded responses (occasionally 503s)
 * under concurrent hits, which upstream looks like a hung/never-loading
 * page rather than a clean error. 1 worker locally trades speed for
 * reliability against a shared instance you don't control; bump it back up
 * if you're pointing BASE_URL at your own local/dedicated instance.
 */
/**
 * timeout is set higher than Playwright's 30s default because this suite
 * runs against a shared PUBLIC demo instance whose response time is outside
 * our control — it has been observed taking 30s+ just to render the login
 * form under load (likely login-throttling after repeated attempts). A tight
 * timeout here doesn't catch real bugs faster, it just kills slow-but-
 * otherwise-fine test runs mid-navigation and produces misleading
 * "browser has been closed" errors instead of the real assertion result.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 90 * 1000,
  expect: { timeout: 10000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html-report', open: 'never' }],
    ['json', { outputFile: 'reports/test-results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: process.env.API_BASE_URL || 'https://opensource-demo.orangehrmlive.com',
      },
    },
  ],

  outputDir: 'test-results/',
});