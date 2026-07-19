#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  extractRunSummary,
  appendToHistory,
  computeFlakinessScores,
} = require('../utils/flaky-tracker');

function renderMarkdown(scores) {
  const rows = scores
    .slice(0, 20)
    .map(
      (s) =>
        `| ${s.testName} | ${s.runs} | ${s.flakyRuns} | ${s.failedRuns} | ${s.flakinessScore} |`
    )
    .join('\n');

  return `# Flaky Test Report

Generated: ${new Date().toISOString()}

Flakiness score = (runs that needed a retry to pass, or ultimately failed) / total runs observed.
A score of 0.00 means the test has been perfectly stable across every recorded run.

| Test | Runs Observed | Flaky Runs | Failed Runs | Flakiness Score |
|---|---|---|---|---|
${rows || '| _no data yet — run `npm test` at least once_ | | | | |'}

## How to use this
- Anything above **0.20** is worth investigating before it erodes trust in the suite.
- A test that's flaky here but never flaky locally usually points to a timing
  assumption that only breaks under CI load or shared-instance latency — check
  the retained trace for that test in \`reports/html-report\` first.
`;
}

function main() {
  const runSummary = extractRunSummary();
  const history = appendToHistory(runSummary);
  const scores = computeFlakinessScores(history);
  const markdown = renderMarkdown(scores);

  fs.writeFileSync(path.join(__dirname, '..', 'FLAKY_REPORT.md'), markdown);
  console.log(`FLAKY_REPORT.md written — ${scores.length} tests tracked across ${history.length} recorded runs.`);
}

main();
