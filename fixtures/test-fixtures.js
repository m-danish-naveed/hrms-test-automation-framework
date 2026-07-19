const base = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { ApiClient } = require('../utils/apiClient');
const { randomEmployee } = require('../utils/faker');
const { logger } = require('../utils/logger');

const ADMIN_USER = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * authenticatedPage
 * ------------------
 * Logs in once via the UI and reuses that browser storage state for the
 * rest of the test, instead of re-typing credentials in every spec. This
 * mirrors how you'd handle auth in a real framework: log in once per worker
 * where possible, not once per test.
 *
 * apiClient
 * ---------
 * A pre-authenticated API context, used both by API specs directly and by
 * UI specs that need to seed/clean up data (e.g. create an employee via API
 * before a UI test, delete it via API afterwards) so that UI tests aren't
 * slowed down or made flaky by using the UI itself for setup.
 *
 * testEmployee
 * ------------
 * Creates a throwaway employee via the API before the test runs and deletes
 * it afterwards, regardless of whether the test passed or failed. This is
 * what keeps this framework safe to run against a SHARED public demo
 * instance — tests never touch seeded/default data, only records they
 * created themselves.
 */
exports.test = base.test.extend({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(ADMIN_USER, ADMIN_PASS);
    await page.waitForURL('**/dashboard/index');
    await use(page);
  },

  // Worker-scoped: logs in ONCE per worker process and is reused across every
  // test in that worker, instead of a fresh browser login per test. Tests
  // that needed testEmployee were previously paying for TWO full sequential
  // logins each (one via the UI authenticatedPage fixture, one via this
  // fixture's own internal browser) — on a slow/throttled shared demo that
  // alone could exceed the whole test's timeout budget before the test body
  // even started. apiClient no longer depends on the built-in `request`
  // fixture (login() creates its own browser/context internally), which is
  // what makes a worker scope possible here — worker-scoped fixtures can
  // only depend on other worker-scoped fixtures, and `request` is test-scoped.
  apiClient: [async ({}, use) => {
    const client = new ApiClient(null);
    await client.login(ADMIN_USER, ADMIN_PASS);
    await use(client);
    await client.dispose();
  }, { scope: 'worker' }],

  testEmployee: async ({ apiClient }, use) => {
    const employee = randomEmployee();
    const createResponse = await apiClient.createEmployee(employee);

    if (createResponse.status() >= 400) {
      throw new Error(
        `testEmployee setup failed: API create returned ${createResponse.status()}. ` +
        `Downstream test would otherwise fail with a confusing "0 results" error instead ` +
        `of this clear setup failure. Check apiClient auth — see README API Testing note.`
      );
    }

    let empNumber = null;

    try {
      const body = await createResponse.json();
      empNumber = body?.data?.empNumber ?? null;
    } catch {
      logger.warn('Could not parse employee creation response — teardown may be skipped');
    }

    await use({ ...employee, empNumber });

    if (empNumber) {
      await apiClient.deleteEmployees([empNumber]);
    } else {
      logger.warn(`Skipped teardown for ${employee.firstName} ${employee.lastName} — no empNumber captured`);
    }
  },
});

exports.expect = base.expect;