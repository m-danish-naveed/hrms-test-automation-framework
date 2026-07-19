const { test, expect } = require('../../../fixtures/test-fixtures');
const { DashboardPage } = require('../../../pages/DashboardPage');
const { logger } = require('../../../utils/logger');

test('@smoke logout returns user to the login page', async ({ authenticatedPage }) => {
  const dashboardPage = new DashboardPage(authenticatedPage);

  await dashboardPage.logout();
  await expect(authenticatedPage).toHaveURL(/auth\/login/);
  logger.pass('Logout redirected to login page');
});
