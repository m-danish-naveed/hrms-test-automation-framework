const { test, expect } = require('@playwright/test');
const Ajv = require('ajv');
const { ApiClient } = require('../../utils/apiClient');
const { randomEmployee } = require('../../utils/faker');
const { logger } = require('../../utils/logger');

const ajv = new Ajv({ allowUnionTypes: true });

// Schema for a single employee record as returned by GET /pim/employees.
// Trimmed to the fields the app is expected to always return — if
// OrangeHRM changes this shape, this test fails loudly instead of a UI
// test failing mysteriously three modules away.
const employeeSchema = {
  type: 'object',
  properties: {
    empNumber: { type: ['number', 'string'] },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
  },
  required: ['empNumber', 'firstName', 'lastName'],
};

const employeeListSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: employeeSchema },
    meta: { type: 'object' },
  },
  required: ['data'],
};

test.describe('API — Employee CRUD', () => {
  let client;
  let createdEmpNumber;

  test.beforeEach(async ({ request }) => {
    client = new ApiClient(request);
    await client.login('Admin', 'admin123');
  });

  test.afterEach(async () => {
    if (createdEmpNumber) {
      await client.deleteEmployees([createdEmpNumber]);
      logger.info(`Teardown: removed employee ${createdEmpNumber}`);
      createdEmpNumber = null;
    }
    await client.dispose();
  });

  test('@smoke GET employees list matches expected schema', async () => {
    const response = await client.getEmployees({ limit: 5 });
    expect(response.status()).toBe(200);

    const body = await response.json();
    const validate = ajv.compile(employeeListSchema);
    const valid = validate(body);

    if (!valid) logger.fail(`Schema validation errors: ${JSON.stringify(validate.errors)}`);
    expect(valid, JSON.stringify(validate.errors)).toBeTruthy();
  });

  test('@smoke POST creates a new employee', async () => {
    const employee = randomEmployee();
    const response = await client.createEmployee(employee);
    expect(response.status()).toBeLessThan(300);

    const body = await response.json();
    createdEmpNumber = body?.data?.empNumber;

    expect(body.data.firstName).toBe(employee.firstName);
    expect(body.data.lastName).toBe(employee.lastName);
    logger.pass(`Created employee ${employee.firstName} ${employee.lastName} via API`);
  });

  test('@regression PUT updates an existing employee', async () => {
    const employee = randomEmployee();
    const createResponse = await client.createEmployee(employee);
    const created = await createResponse.json();
    createdEmpNumber = created?.data?.empNumber;

    const updatedName = `${employee.lastName}-Updated`;
    const updateResponse = await client.updateEmployee(createdEmpNumber, {
      firstName: employee.firstName,
      lastName: updatedName,
    });

    expect(updateResponse.status()).toBeLessThan(300);
    const updatedBody = await updateResponse.json();
    expect(updatedBody.data.lastName).toBe(updatedName);
    logger.pass(`Updated employee ${createdEmpNumber} lastName to ${updatedName}`);
  });

  test('@regression DELETE removes an employee', async () => {
    const employee = randomEmployee();
    const createResponse = await client.createEmployee(employee);
    const created = await createResponse.json();
    const empNumber = created?.data?.empNumber;

    const deleteResponse = await client.deleteEmployees([empNumber]);
    expect(deleteResponse.status()).toBeLessThan(300);

    const listResponse = await client.getEmployees({ nameOrId: employee.firstName });
    const listBody = await listResponse.json();
    const stillExists = (listBody.data || []).some((e) => e.empNumber === empNumber);

    expect(stillExists).toBeFalsy();
    logger.pass(`Confirmed employee ${empNumber} no longer exists after delete`);
    // no afterEach cleanup needed — already deleted
    createdEmpNumber = null;
  });
});