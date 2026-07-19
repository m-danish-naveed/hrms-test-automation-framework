const { faker } = require('@faker-js/faker');

/**
 * Generates a unique-enough employee for tests that create records against
 * the shared public demo. Uses a run-scoped suffix so records created by
 * concurrent CI runs / other engineers don't collide in search results.
 */
function randomEmployee() {
  const suffix = Date.now().toString().slice(-6);
  return {
    firstName: `${faker.person.firstName()}`,
    lastName: `QA${suffix}`,
  };
}

function randomComment() {
  return faker.lorem.sentence();
}

module.exports = { randomEmployee, randomComment };
