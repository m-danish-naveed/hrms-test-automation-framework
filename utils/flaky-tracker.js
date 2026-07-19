const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, '..', 'reports', 'test-results.json');
const HISTORY_FILE = path.join(__dirname, '..', 'flaky-history.json');

/**
 * Reads Playwright's JSON reporter output for the run that just finished
 * and extracts, per test, whether it needed retries and what its final
 * outcome was. A test that passed only after 1+ retries is flaky by
 * definition — it produced different results on identical input.
 */
function extractRunSummary() {
  if (!fs.existsSync(RESULTS_FILE)) {
    throw new Error(`No results file at ${RESULTS_FILE}. Run tests first (npm test).`);
  }

  const raw = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const summary = [];

  const walkSuites = (suites, parentTitle = '') => {
    for (const suite of suites || []) {
      const title = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const attempts = test.results || [];
          const retryCount = attempts.length - 1;
          const finalStatus = attempts[attempts.length - 1]?.status || 'unknown';
          const everFailed = attempts.some((a) => a.status === 'failed' || a.status === 'timedOut');

          summary.push({
            testName: `${title} > ${spec.title}`,
            project: test.projectName,
            retryCount,
            finalStatus,
            flaky: retryCount > 0 && finalStatus === 'passed' && everFailed,
            timestamp: new Date().toISOString(),
          });
        }
      }
      if (suite.suites) walkSuites(suite.suites, title);
    }
  };

  walkSuites(raw.suites);
  return summary;
}

/**
 * Appends this run's summary to a persisted history file so flakiness can
 * be measured over time (a test that failed once isn't interesting — a
 * test that's flaky across 10 runs is).
 */
function appendToHistory(runSummary) {
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  }
  history.push(...runSummary);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  return history;
}

/**
 * Aggregates history into a per-test flakiness score:
 *   score = (runs with a retry or failure-then-pass) / (total runs seen)
 */
function computeFlakinessScores(history) {
  const byTest = {};

  for (const entry of history) {
    if (!byTest[entry.testName]) {
      byTest[entry.testName] = { runs: 0, flakyRuns: 0, failedRuns: 0 };
    }
    byTest[entry.testName].runs += 1;
    if (entry.flaky) byTest[entry.testName].flakyRuns += 1;
    if (entry.finalStatus === 'failed' || entry.finalStatus === 'timedOut') {
      byTest[entry.testName].failedRuns += 1;
    }
  }

  return Object.entries(byTest)
    .map(([testName, stats]) => ({
      testName,
      ...stats,
      flakinessScore: +((stats.flakyRuns + stats.failedRuns) / stats.runs).toFixed(2),
    }))
    .sort((a, b) => b.flakinessScore - a.flakinessScore);
}

module.exports = { extractRunSummary, appendToHistory, computeFlakinessScores, HISTORY_FILE };
