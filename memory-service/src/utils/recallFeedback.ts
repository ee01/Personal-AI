import type BetterSqlite3 from 'better-sqlite3';

export type RecallFeedbackAction = 'positive' | 'negative';
export type RecallFeedbackTargetType =
  | 'message'
  | 'chunk'
  | 'entity'
  | 'source_memory';

export function isSceneScopedRecallFeedbackDetail(
  detail?: string | null,
): boolean {
  if (!detail) return false;
  try {
    const parsed = JSON.parse(detail);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false;
    }
    const interaction = (parsed as Record<string, unknown>).interaction;
    return interaction === 'memory_relevance_trainer';
  } catch {
    return false;
  }
}

export function getRecallFeedbackAction(
  db: BetterSqlite3.Database,
  targetType: RecallFeedbackTargetType,
  targetId: string,
): RecallFeedbackAction | undefined {
  try {
    const row = db
      .prepare(
        `SELECT action, detail
         FROM memory_feedback_events
         WHERE feedback_type = 'recall_quality'
           AND target_type = ?
           AND target_id = ?
         LIMIT 1`,
      )
      .get(targetType, targetId) as
      | { action: string; detail?: string | null }
      | undefined;

    if (
      row?.action === 'negative' &&
      isSceneScopedRecallFeedbackDetail(row.detail)
    ) {
      return undefined;
    }
    return row?.action === 'positive' || row?.action === 'negative'
      ? row.action
      : undefined;
  } catch {
    return undefined;
  }
}
