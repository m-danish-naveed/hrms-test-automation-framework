const { test, expect } = require('../../../fixtures/test-fixtures');
const { LeavePage } = require('../../../pages/LeavePage');
const { logger } = require('../../../utils/logger');

test.describe('Leave — Cancel', () => {
  test('@smoke cancels a pending leave request', async ({ authenticatedPage }) => {
    const leavePage = new LeavePage(authenticatedPage);

    await leavePage.gotoApplyLeave();

    test.skip(
      !(await leavePage.hasLeaveTypesWithBalance()),
      'This account has no leave types with an available balance — confirmed via live check. ' +
      'This is a data/environment limitation of the shared demo account, not a test bug. ' +
      'Assign a leave entitlement to this account via Leave > Entitlements as admin, then re-run.'
    );

    await leavePage.applyLeave({ leaveType: 'CAN - Sick', comment: 'to be cancelled' });
    await expect(leavePage.successToast).toBeVisible();

    await leavePage.gotoMyLeaveList();
    await leavePage.cancelFirstLeave();

    const status = await leavePage.statusBadge.first().textContent();
    expect(status).toMatch(/Cancelled|Rejected/);
    logger.pass('Pending leave cancelled successfully');
  });

  /**
   * REGRESSION CANDIDATE — not yet confirmed against a live run.
   *
   * OrangeHRM's UI is documented (community forums / GitHub issues) to, in
   * some versions, allow an employee to cancel a leave request that an
   * admin has already APPROVED, without any extra confirmation step beyond
   * the standard cancel dialog. If that holds on the current demo build,
   * it's a real gap: an approved leave changes payroll/attendance state
   * elsewhere in the app, so silently letting it be cancelled without a
   * distinct "this is already approved" warning is a legitimate UX/data
   * integrity bug, not just a missing feature.
   *
   * This test is written to assert the SAFE behavior (a confirmation or
   * block). Run it against the live demo before relying on it — if it
   * fails, that's the bug: document it in the README bug section with a
   * screenshot and trace, don't just loosen the assertion to make it pass.
   */
  test('@regression approved leave requires explicit confirmation before cancellation', async ({
    authenticatedPage,
  }) => {
    const leavePage = new LeavePage(authenticatedPage);

    await leavePage.gotoMyLeaveList();
    const approvedRow = authenticatedPage
      .locator('.oxd-table-card')
      .filter({ hasText: 'Approved' })
      .first();

    test.skip(
      (await approvedRow.count()) === 0,
      'No approved leave found for this user — approve one via Leave module as admin first, then re-run.'
    );

    await approvedRow.getByText('Cancel').click();

    const confirmDialog = authenticatedPage.locator('.oxd-dialog-container');
    await expect(confirmDialog).toContainText(/approved/i);
    logger.info('Confirmation dialog correctly warns about cancelling an approved leave');
  });
});