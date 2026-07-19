const { logger } = require('../utils/logger');

class PIMPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Employee list
    this.addButton = page.getByRole('button', { name: 'Add' });
    this.employeeNameSearch = page.locator('.oxd-autocomplete-wrapper input').first();
    this.searchButton = page.getByRole('button', { name: 'Search' });
    this.tableRows = page.locator('.oxd-table-card');
    this.noRecordsFound = page.getByText('No Records Found').first();
    this.successToast = page.locator('.oxd-toast-content-text').first();

    // Add Employee form
    this.firstNameInput = page.locator('input[name="firstName"]');
    this.lastNameInput = page.locator('input[name="lastName"]');
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.employeeIdInput = page.locator('.oxd-input-group:has-text("Employee Id") input');

    // Personal details / edit
    this.editSuccessToast = page.locator('.oxd-toast-content-text').first();
    this.deleteButton = page.getByRole('button', { name: 'Delete Selected' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Yes, Delete' });
    this.rowCheckbox = page.locator('.oxd-table-row .oxd-checkbox-input').first();
  }

  async gotoAddEmployee() {
    logger.info('Navigating to Add Employee form');
    await this.page.goto('/web/index.php/pim/addEmployee', { waitUntil: 'domcontentloaded' });
    await this.firstNameInput.waitFor({ state: 'visible', timeout: 20000 });
  }

  async addEmployee({ firstName, lastName }) {
    logger.info('Add Employee started');
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.saveButton.click();
    logger.info('Employee details submitted');
  }

  async gotoEmployeeList() {
    await this.page.goto('/web/index.php/pim/viewEmployeeList', { waitUntil: 'domcontentloaded' });
    await this.searchButton.waitFor({ state: 'visible', timeout: 20000 });
  }

  async searchByName(name) {
    logger.info(`Searching employee: ${name}`);
    // Deliberately NOT clicking an autocomplete suggestion here: when a real
    // matching employee exists, that suggestion is a link to the employee's
    // own profile page, not a "filter the list" action — clicking it
    // navigates away entirely, which is why Search then can't be found.
    // Typing the name and clicking Search is sufficient to filter the list.
    await this.employeeNameSearch.fill(name);
    await this.page.locator('.oxd-form-loader').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.searchButton.click({ timeout: 20000 });
    // Search triggers an async fetch; wait for the results loader to finish
    // before returning, since .count() below (unlike expect().toBeVisible())
    // does NOT wait for anything — it just checks what's on screen right now.
    await this.page.locator('.oxd-form-loader').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }

  async getResultCount() {
    await Promise.race([
      this.tableRows.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.noRecordsFound.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});
    return this.tableRows.count();
  }

  async deleteFirstResult() {
    logger.info('Deleting first employee result');
    await this.rowCheckbox.check();
    await this.deleteButton.click();
    await this.confirmDeleteButton.click();
  }
}

module.exports = { PIMPage };