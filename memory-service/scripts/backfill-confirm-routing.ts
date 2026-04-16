import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { ConfirmRequestRepository } from '../src/repositories/ConfirmRequestRepository.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || process.env.USER_ID || 'esone.qiu';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function classify(question: string, context: string | null) {
  const combined = `${question}\n${context ?? ''}`;
  if (
    /审批|批准|授权|approval|approve|should we|帮我决定|是否要|选方向/i.test(
      combined,
    )
  ) {
    return {
      routing: 'decision' as const,
      state: 'pending' as const,
      reasonCode: 'authority_required',
      gapType: 'decision_blocker',
    };
  }
  if (
    /负责人|owner|eta|时间表|上线时间|何时|什么时候|进展|deadline|排期/i.test(
      combined,
    )
  ) {
    return {
      routing: 'watch' as const,
      state: 'snoozed' as const,
      reasonCode: 'owner_eta_gap',
      gapType: 'owner_eta',
    };
  }
  if (
    /会不会|是否会|未来|接下来|有没有计划|是否有计划|迁移|重命名|调整|变化|变更|roadmap|plan|rename|migrate|change/i.test(
      combined,
    )
  ) {
    return {
      routing: 'watch' as const,
      state: 'snoozed' as const,
      reasonCode: 'future_monitoring',
      gapType: 'future_monitoring',
    };
  }
  if (/http|链接|文档|doc|sheet|ticket|issue|artifact/i.test(combined)) {
    return {
      routing: 'watch' as const,
      state: 'snoozed' as const,
      reasonCode: 'artifact_gap',
      gapType: 'artifact_check',
    };
  }

  return {
    routing: 'watch' as const,
    state: 'snoozed' as const,
    reasonCode: 'future_monitoring',
    gapType: 'future_monitoring',
  };
}

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const db = ctx.db;
  const repo = new ConfirmRequestRepository(db);
  const now = Math.floor(Date.now() / 1000);

  const targets = db
    .prepare(
      `SELECT id, question, context, category, related_entity_id, priority, created_at
     FROM confirm_requests
     WHERE category = 'evidence_resolution'
       AND priority = 'normal'
       AND state = 'pending'
       AND routing IS NULL
     ORDER BY created_at ASC`,
    )
    .all() as Array<{
    id: string;
    question: string;
    context: string | null;
    category: string;
    related_entity_id: string | null;
    priority: string;
    created_at: number;
  }>;

  const update = db.transaction(() => {
    for (const row of targets) {
      const classified = classify(row.question, row.context);
      const sourceAnchor = row.related_entity_id
        ? `entity:${row.related_entity_id}`
        : `legacy:${slugify(row.question)}`;
      db.prepare(
        `UPDATE confirm_requests
         SET routing = ?,
             state = ?,
             reason_code = ?,
             source_anchor = ?,
             gap_type = ?,
             snooze_until = ?,
             expires_at = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(
        classified.routing,
        classified.state,
        classified.reasonCode,
        sourceAnchor,
        classified.gapType,
        classified.state === 'snoozed' ? now + 72 * 3600 : null,
        classified.state === 'snoozed' ? row.created_at + 14 * 24 * 3600 : null,
        now,
        row.id,
      );
    }
  });

  update();
  const backfilled = repo.backfillDedupeKeys();
  const dedupeSummary = repo.dedupePendingRequests();

  const summary = db
    .prepare(
      `SELECT COALESCE(routing, 'null') AS routing, state, COUNT(*) AS count
     FROM confirm_requests
     WHERE category = 'evidence_resolution'
     GROUP BY COALESCE(routing, 'null'), state
     ORDER BY routing, state`,
    )
    .all();

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        scanned: targets.length,
        backfilledDedupeKeys: backfilled,
        dedupeSummary,
        summary,
      },
      null,
      2,
    ),
  );

  ucm.closeAll();
}

main().catch((error) => {
  console.error('[backfill-confirm-routing] Failed:', error);
  process.exit(1);
});
