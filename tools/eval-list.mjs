#!/usr/bin/env node
import {
  findLatestSummaries,
  formatOutcome,
  formatSchedule,
  getResultRoot,
  loadRegistry,
  loadSuiteCases,
} from './eval-lib.mjs';

const registry = await loadRegistry();
const resultRoot = getResultRoot(registry);
const summaries = await findLatestSummaries(resultRoot);

const latestBySuite = new Map();
for (const summary of summaries) {
  if (!latestBySuite.has(summary.suiteId)) latestBySuite.set(summary.suiteId, summary);
}

const rows = [];
for (const suite of registry.suites || []) {
  const cases = await loadSuiteCases(suite);
  const latest = latestBySuite.get(suite.id);
  rows.push({
    id: suite.id,
    title: suite.title,
    cases: cases.length,
    runMode: suite.runMode || 'manual',
    schedule: formatSchedule(suite.schedule),
    latest: latest
      ? `${formatOutcome(latest.status)} @ ${latest.startedAt}`
      : '-',
    repair: latest?.repairStatus || suite.repair?.mode || registry.defaults?.repair?.mode || '-',
  });
}

const headers = ['Suite', 'Cases', 'Mode', 'Schedule', 'Latest', 'Repair'];
const widths = [
  Math.max(headers[0].length, ...rows.map((row) => row.id.length)),
  Math.max(headers[1].length, ...rows.map((row) => String(row.cases).length)),
  Math.max(headers[2].length, ...rows.map((row) => row.runMode.length)),
  Math.max(headers[3].length, ...rows.map((row) => row.schedule.length)),
  Math.max(headers[4].length, ...rows.map((row) => row.latest.length)),
  Math.max(headers[5].length, ...rows.map((row) => String(row.repair).length)),
];

function pad(value, width) {
  return String(value).padEnd(width, ' ');
}

console.log(headers.map((header, index) => pad(header, widths[index])).join('  '));
console.log(widths.map((width) => '-'.repeat(width)).join('  '));
for (const row of rows) {
  console.log(
    [
      pad(row.id, widths[0]),
      pad(row.cases, widths[1]),
      pad(row.runMode, widths[2]),
      pad(row.schedule, widths[3]),
      pad(row.latest, widths[4]),
      pad(row.repair, widths[5]),
    ].join('  '),
  );
}
