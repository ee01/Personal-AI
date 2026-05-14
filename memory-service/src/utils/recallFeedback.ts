import type BetterSqlite3 from 'better-sqlite3';

export type RecallFeedbackAction = 'positive' | 'negative';
export type RecallFeedbackTargetType = 'message' | 'chunk' | 'entity';

export function getRecallFeedbackAction(
  db: BetterSqlite3.Database,
  targetType: RecallFeedbackTargetType,
  targetId: string,
): RecallFeedbackAction | undefined {
  try {
    const row = db
      .prepare(
        `SELECT action
         FROM memory_feedback_events
         WHERE feedback_type = 'recall_quality'
           AND target_type = ?
           AND target_id = ?
         LIMIT 1`,
      )
      .get(targetType, targetId) as { action: string } | undefined;

    return row?.action === 'positive' || row?.action === 'negative'
      ? row.action
      : undefined;
  } catch {
    return undefined;
  }
}
