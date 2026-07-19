/**
 * Deliberately thin logger. Playwright already gives you test.step() and the
 * HTML/trace reporters for step-level detail — this just adds consistent,
 * greppable, leveled console output on top of that for quick failure triage
 * in CI logs without opening the HTML report.
 */
const LEVELS = { INFO: 'INFO', PASS: 'PASS', FAIL: 'FAIL', WARN: 'WARN' };

function timestamp() {
  return new Date().toISOString().split('T')[1].replace('Z', '');
}

function log(level, message) {
  // eslint-disable-next-line no-console
  console.log(`[${timestamp()}] ${level.padEnd(4)} ${message}`);
}

const logger = {
  info: (msg) => log(LEVELS.INFO, msg),
  pass: (msg) => log(LEVELS.PASS, msg),
  fail: (msg) => log(LEVELS.FAIL, msg),
  warn: (msg) => log(LEVELS.WARN, msg),
};

module.exports = { logger };
