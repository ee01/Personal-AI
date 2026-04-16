import fs from 'node:fs';
import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';

const dataDir =
  process.env.DATA_DIR || '/tmp/personal-ai-routing-validation-suite';
const outputPath =
  process.env.OUTPUT_PATH ||
  path.resolve(
    process.cwd(),
    'validation',
    'confirm-routing-validation-report.md',
  );

const scenarios = [
  { userId: 'val-mixed', label: 'mixed' },
  { userId: 'val-owner', label: 'owner-eta-heavy' },
  { userId: 'val-future', label: 'future-monitoring-heavy' },
];

function count(
  db: ReturnType<UserContextManager['getContext']>['db'],
  sql: string,
  ...params: unknown[]
) {
  return (db.prepare(sql).get(...params) as { count: number }).count;
}

async function main() {
  const ucm = new UserContextManager(dataDir);
  const lines = [
    '# Confirm Routing Validation Report',
    '',
    `Data dir: ${dataDir}`,
    '',
  ];

  for (const scenario of scenarios) {
    const ctx = ucm.getContext(scenario.userId);
    const db = ctx.db;
    const decisionPending = count(
      db,
      "SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending' AND COALESCE(routing, 'decision') = 'decision'",
    );
    const watchSnoozed = count(
      db,
      "SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'snoozed' AND routing = 'watch'",
    );
    const watchPending = count(
      db,
      "SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending' AND routing = 'watch'",
    );
    const deduplicated = count(
      db,
      "SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'deduplicated'",
    );

    lines.push(`## ${scenario.label} (${scenario.userId})`);
    lines.push(`- decision/pending: ${decisionPending}`);
    lines.push(`- watch/snoozed: ${watchSnoozed}`);
    lines.push(`- watch/pending: ${watchPending}`);
    lines.push(`- deduplicated: ${deduplicated}`);
    lines.push('');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(JSON.stringify({ outputPath }, null, 2));
  ucm.closeAll();
}

main().catch((error) => {
  console.error('[run-confirm-routing-validation] Failed:', error);
  process.exit(1);
});
