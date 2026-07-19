const { test, expect } = require('../../../fixtures/test-fixtures');
const { LoginPage } = require('../../../pages/LoginPage');
const { DashboardPage } = require('../../../pages/DashboardPage');
const { logger } = require('../../../utils/logger');
const users = require('../../../fixtures/users.json');

test.describe('Login', () => {
  test.beforeEach(async () => {
    // Small pacing gap between login attempts. The shared demo instance
    // appears to slow down progressively when hit with repeated login
    // attempts in quick succession (likely basic anti-brute-force
    // throttling) — this test suite intentionally includes several
    // invalid-login cases back to back, so this gap keeps us from
    // triggering that ourselves.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  for (const user of users) {
    test(`${user.tag} login: ${user.case}`, async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.login(user.username, user.password);

      if (user.expected === 'success') {
        await page.waitForURL('**/dashboard/index');
        const header = await dashboardPage.isLoaded();
        expect(header).toContain('Dashboard');
        logger.pass(`Login successful for ${user.username}`);
      }

      if (user.expected === 'failure') {
        const message = await loginPage.getErrorMessage();
        expect(message).toContain('Invalid credentials');
        logger.fail(`Login correctly rejected for ${user.username}`);
      }

      if (user.expected === 'validation') {
        const errorCount = await loginPage.getRequiredFieldErrorCount();
        expect(errorCount).toBeGreaterThan(0);
        logger.fail(`Required-field validation shown for empty input (case: ${user.case})`);
      }
    });
  }

  test('@regression session expires after cookie is cleared mid-session', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('Admin', 'admin123');
    await page.waitForURL('**/dashboard/index');

    // Simulate session expiration by clearing cookies, then attempt a
    // protected navigation — the app should bounce back to login.
    await context.clearCookies();
    // The app's own client-side router redirects us before this manual
    // goto finishes, which Playwright reports as an aborted navigation —
    // that's expected here, not a failure. What matters is the final URL.
    await page.goto('/web/index.php/pim/viewEmployeeList').catch(() => {});

    await expect(page).toHaveURL(/auth\/login/);
    logger.pass('Expired session correctly redirected to login');
  });
});