const { test, expect } = require('../../../fixtures/test-fixtures');
const { PIMPage } = require('../../../pages/PIMPage');
const { randomEmployee } = require('../../../utils/faker');
const { logger } = require('../../../utils/logger');

test.describe('PIM — Add Employee', () => {
  test('@smoke adds a new employee successfully', async ({ authenticatedPage, apiClient }) => {
    const pimPage = new PIMPage(authenticatedPage);
    const employee = randomEmployee();

    await pimPage.gotoAddEmployee();
    await pimPage.addEmployee(employee);

    await authenticatedPage.waitForURL('**/pim/viewPersonalDetails/**');
    logger.pass(`Employee ${employee.firstName} ${employee.lastName} created via UI`);

    // Clean up through the API so this run doesn't leave data behind on
    // the shared demo instance — never rely on UI delete for teardown,
    // it's slower and adds another point of flakiness to test cleanup.
    const empIdValue = await authenticatedPage.locator('input.oxd-input').first().inputValue().catch(() => null);
    if (empIdValue) {
      await apiClient.deleteEmployees([empIdValue]);
      logger.info(`Teardown: deleted employee id ${empIdValue}`);
    }
  });

  test('@regression rejects an employee with no last name', async ({ authenticatedPage }) => {
    const pimPage = new PIMPage(authenticatedPage);

    await pimPage.gotoAddEmployee();
    await pimPage.firstNameInput.fill('Ayesha');
    await pimPage.saveButton.click();

    const errors = authenticatedPage.locator('.oxd-input-field-error-message');
    await expect(errors.first()).toBeVisible();
    logger.fail('Add Employee correctly blocked without a last name');
  });
});
