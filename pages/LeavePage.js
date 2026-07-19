const { logger } = require('../utils/logger');

class LeavePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Apply Leave
    this.leaveTypeDropdown = page.locator('.oxd-select-text').first();
    this.fromDateInput = page.locator('input[placeholder="yyyy-dd-mm"]').first();
    this.toDateInput = page.locator('input[placeholder="yyyy-dd-mm"]').nth(1);
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.successToast = page.locator('.oxd-toast-content-text').first();

    // My Leave list / cancel
    this.leaveListRows = page.locator('.oxd-table-card');
    this.cancelButton = page.getByRole('button', { name: 'Cancel' }).first();
    this.statusBadge = page.locator('.oxd-table-cell').filter({ hasText: /Pending|Approved|Rejected|Cancelled/ });

    // Search
    this.fromDateFilter = page.locator('input[placeholder="yyyy-dd-mm"]').first();
    this.toDateFilter = page.locator('input[placeholder="yyyy-dd-mm"]').nth(1);
    this.searchButton = page.getByRole('button', { name: 'Search' });
  }

  async gotoApplyLeave() {
    logger.info('Navigating to Apply Leave page');
    // This page fetches its leave-type data (leave-types/eligible) and then
    // — confirmed via network capture — genuinely re-fetches/re-renders it
    // a second time shortly after the first load. Interacting with the
    // dropdown in that narrow window between the two renders is what caused
    // intermittent "element was detached from the DOM" failures. Waiting
    // for the actual data response (not just a CSS loader class, which can
    // toggle rapidly across the two render passes) plus a short settle
    // buffer makes this reliable.
    const eligibleTypesResponse = this.page
      .waitForResponse((res) => res.url().includes('/api/v2/leave/leave-types/eligible'), { timeout: 20000 })
      .catch(() => null);
    await this.page.goto('/web/index.php/leave/applyLeave', { waitUntil: 'domcontentloaded' });
    await eligibleTypesResponse;
    // The dropdown only exists at all if the account has at least one leave
    // type with an available balance — otherwise the page shows "No Leave
    // Types with Leave Balance" instead, with no dropdown to interact with.
    // Confirmed via live check: this is a genuine account/data limitation
    // on the shared demo, not a timing issue — don't wait for the dropdown
    // here, since for an account with no balance it will never appear.
    await Promise.race([
      this.leaveTypeDropdown.waitFor({ state: 'visible', timeout: 20000 }),
      this.page.getByText('No Leave Types with Leave Balance').waitFor({ state: 'visible', timeout: 20000 }),
    ]).catch(() => {});
    await this.page.waitForTimeout(1000); // let whichever render pass settle
  }

  async hasLeaveTypesWithBalance() {
    return !(await this.page.getByText('No Leave Types with Leave Balance').isVisible().catch(() => false));
  }

  async applyLeave({ leaveType, comment } = {}) {
    logger.info(`Applying leave: ${leaveType ?? '(first available type)'}`);
    // The form shows a loading overlay while it fetches leave-type options;
    // clicking through it causes flaky "element intercepts pointer events"
    // / "detached from DOM" failures. Wait for it to clear first.
    await this.page.locator('.oxd-form-loader').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    try {
      await this.leaveTypeDropdown.click({ timeout: 15000 });
    } catch {
      logger.warn('Leave type dropdown click failed (likely a re-render mid-click) — retrying once.');
      await this.page.waitForTimeout(1500);
      await this.leaveTypeDropdown.click({ timeout: 15000 });
    }

    const dropdownOptions = this.page.locator('.oxd-select-dropdown span');
    await dropdownOptions.first().waitFor({ state: 'visible', timeout: 15000 });

    const allTexts = await dropdownOptions.allTextContents();
    logger.info(`Available leave types in dropdown: ${allTexts.join(', ')}`);

    // This shared public demo can have junk/test data mixed into the leave
    // type list (e.g. an option like "asdfgh" left behind by someone else
    // testing against the same instance) alongside real ones. A naive
    // "just pick the first option" fallback can grab junk with no real
    // entitlement behind it, which the form then silently rejects — no
    // request fires, no toast appears, it just re-highlights the date
    // fields. Only select options that actually look like real leave types.
    const realTypePattern = /^[A-Za-z]{2,5}\s*-\s*\S+/;
    let selected = false;

    if (leaveType) {
      const match = this.page.getByText(leaveType, { exact: false }).first();
      try {
        await match.click({ timeout: 5000 });
        selected = true;
      } catch {
        logger.warn(`Leave type "${leaveType}" not found in this instance's dropdown — selecting first valid-looking option instead.`);
      }
    }

    if (!selected) {
      const validIndex = allTexts.findIndex((t) => realTypePattern.test(t.trim()));
      if (validIndex === -1) {
        throw new Error(
          `No valid-looking leave type found in dropdown (only junk/placeholder entries?). Options were: ${allTexts.join(', ')}`
        );
      }
      logger.info(`Selecting leave type: ${allTexts[validIndex].trim()}`);
      await dropdownOptions.nth(validIndex).click();
    }

    // The form doesn't reliably come with valid default dates — submitting
    // without explicitly setting them makes the app just highlight/refocus
    // the date fields and silently do nothing (no request, no toast, no
    // error), which is why this needs to be explicit rather than assumed.
    // Placeholder format is genuinely "yyyy-dd-mm" (day before month).
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${dd}-${mm}`;
    };
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.fromDateInput.fill(formatDate(today));
    await this.page.keyboard.press('Escape'); // close any date-picker popover
    await this.toDateInput.fill(formatDate(tomorrow));
    await this.page.keyboard.press('Escape');

    if (comment) {
      await this.page.locator('textarea').fill(comment);
    }
    await this.applyButton.click();
  }

  async gotoMyLeaveList() {
    await this.page.goto('/web/index.php/leave/viewMyLeaveList');
  }

  async gotoLeaveList() {
    await this.page.goto('/web/index.php/leave/viewLeaveList');
  }

  async cancelFirstLeave() {
    logger.info('Cancelling first leave record');
    await this.cancelButton.click();
  }

  async getLeaveCount() {
    return this.leaveListRows.count();
  }
}

module.exports = { LeavePage };