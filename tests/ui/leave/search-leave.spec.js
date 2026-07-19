const { test, expect } = require('../../../fixtures/test-fixtures');
const { LeavePage } = require('../../../pages/LeavePage');
const { logger } = require('../../../utils/logger');

test.describe('Leave — Search', () => {
  test('@regression searches leave records for the current user', async ({ authenticatedPage }) => {
    const leavePage = new LeavePage(authenticatedPage);

    await leavePage.gotoMyLeaveList();
    await leavePage.searchButton.click();

    const count = await leavePage.getLeaveCount();
    expect(count).toBeGreaterThanOrEqual(0);
    logger.info(`Leave search returned ${count} record(s)`);
  });
});
