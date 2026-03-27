import path from 'node:path';

import { ActionRepository } from '../src/repositories/ActionRepository.js';
import { UserContextManager } from '../src/core/UserContextManager.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || process.env.USER_ID || 'esone.qiu';

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const actionRepo = new ActionRepository(ctx.db);

  const before = ctx.db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM proposed_actions
       WHERE action_type = 'create_confirm_request'
         AND queue_status = 'queued'
         AND execution_mode = 'manual'`,
    )
    .get() as { count: number };

  const rows = ctx.db
    .prepare(
      `SELECT id, thread_id
       FROM proposed_actions
       WHERE action_type = 'create_confirm_request'
         AND queue_status = 'queued'
         AND execution_mode = 'manual'
       ORDER BY created_at ASC`,
    )
    .all() as Array<{ id: string; thread_id: string | null }>;

  const affectedThreads = new Set<string>();
  for (const row of rows) {
    actionRepo.cancel(
      row.id,
      'Cancelled stale manual create_confirm_request after semantic dedupe rollout',
    );
    if (row.thread_id) {
      affectedThreads.add(row.thread_id);
    }
  }

  const after = ctx.db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM proposed_actions
       WHERE action_type = 'create_confirm_request'
         AND queue_status = 'queued'`,
    )
    .get() as { count: number };

  const totalQueued = ctx.db
    .prepare(`SELECT COUNT(*) AS count FROM proposed_actions WHERE queue_status = 'queued'`)
    .get() as { count: number };

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        cancelledActions: rows.length,
        beforeQueuedManualCreateConfirmRequest: before.count,
        afterQueuedCreateConfirmRequest: after.count,
        remainingTotalQueuedActions: totalQueued.count,
        affectedThreads: affectedThreads.size,
      },
      null,
      2,
    ),
  );

  ucm.closeAll();
}

main().catch((error) => {
  console.error('[cancel-stale-confirm-actions] Failed:', error);
  process.exit(1);
});
