import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { ConfirmRequestRepository } from '../src/repositories/ConfirmRequestRepository.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || process.env.USER_ID || 'esone.qiu';

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const repo = new ConfirmRequestRepository(ctx.db);

  const beforePending = ctx.db
    .prepare(`SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending'`)
    .get() as { count: number };

  const dedupeSummary = repo.dedupePendingRequests();
  const backfilled = repo.backfillDedupeKeys();

  const afterPending = ctx.db
    .prepare(`SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending'`)
    .get() as { count: number };
  const deduplicated = ctx.db
    .prepare(`SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'deduplicated'`)
    .get() as { count: number };

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        beforePending: beforePending.count,
        afterPending: afterPending.count,
        deduplicatedCount: deduplicated.count,
        backfilledDedupeKeys: backfilled,
        ...dedupeSummary,
      },
      null,
      2,
    ),
  );

  ucm.closeAll();
}

main().catch((error) => {
  console.error('[dedupe-confirm-requests] Failed:', error);
  process.exit(1);
});
