const { test, expect } = require('../../../fixtures/test-fixtures');
const { LeavePage } = require('../../../pages/LeavePage');
const { randomComment } = require('../../../utils/faker');
const { logger } = require('../../../utils/logger');

test.describe('Leave — Apply', () => {
  test('@smoke submits a leave application successfully', async ({ authenticatedPage }) => {
    const leavePage = new LeavePage(authenticatedPage);

    await leavePage.gotoApplyLeave();

    test.skip(
      !(await leavePage.hasLeaveTypesWithBalance()),
      'This account has no leave types with an available balance — confirmed via live check ' +
      '(the page shows "No Leave Types with Leave Balance" and there is no dropdown at all). ' +
      'This is a data/environment limitation of the shared demo account, not a test bug. ' +
      'Assign a leave entitlement to this account via Leave > Entitlements as admin, then re-run.'
    );

    await leavePage.applyLeave({ leaveType: 'CAN - Sick', comment: randomComment() });

    await expect(leavePage.successToast).toBeVisible();
    logger.pass('Leave application submitted');
  });
});