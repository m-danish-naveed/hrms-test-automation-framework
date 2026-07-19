const { test, expect } = require('../../../fixtures/test-fixtures');
const { PIMPage } = require('../../../pages/PIMPage');
const { logger } = require('../../../utils/logger');

test.describe('PIM — Update Employee', () => {
  test('@regression updates an employee last name from the personal details page', async ({
    authenticatedPage,
    testEmployee,
  }) => {
    const pimPage = new PIMPage(authenticatedPage);
    const updatedLastName = `${testEmployee.lastName}-Updated`;

    await pimPage.gotoEmployeeList();
    await pimPage.searchByName(`${testEmployee.firstName} ${testEmployee.lastName}`);
    await authenticatedPage.locator('.oxd-table-cell-actions button').first().click();

    await authenticatedPage.waitForURL('**/pim/viewPersonalDetails/**');
    const lastNameField = authenticatedPage.locator('input[name="lastName"]');
    await lastNameField.fill(updatedLastName);
    await authenticatedPage.getByRole('button', { name: 'Save' }).first().click();

    await expect(pimPage.editSuccessToast).toBeVisible();
    logger.pass(`Employee last name updated to ${updatedLastName}`);
  });
});
