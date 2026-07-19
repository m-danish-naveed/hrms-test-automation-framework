const { test, expect } = require('../../../fixtures/test-fixtures');
const { PIMPage } = require('../../../pages/PIMPage');
const { logger } = require('../../../utils/logger');

test.describe('PIM — Search Employee', () => {
  // testEmployee creates the record via API before this test runs and
  // deletes it via API afterwards — the UI test only ever exercises search.
  test('@smoke finds an existing employee by name', async ({ authenticatedPage, testEmployee }) => {
    const pimPage = new PIMPage(authenticatedPage);

    await pimPage.gotoEmployeeList();
    await pimPage.searchByName(`${testEmployee.firstName} ${testEmployee.lastName}`);

    const count = await pimPage.getResultCount();
    expect(count).toBeGreaterThan(0);
    logger.pass(`Found ${count} result(s) for ${testEmployee.firstName} ${testEmployee.lastName}`);
  });

  test('@regression shows no results for a name that does not exist', async ({ authenticatedPage }) => {
    const pimPage = new PIMPage(authenticatedPage);

    await pimPage.gotoEmployeeList();
    await pimPage.searchByName('Zzzznonexistentname9999');

    await expect(pimPage.noRecordsFound).toBeVisible();
    logger.fail('Search correctly returned no records for a non-existent name');
  });
});
