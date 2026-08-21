/**
 * Follow-up posts should look like a person bumping the thread,
 * not a labeled machine retry.
 */
const MACHINE_FOLLOWUP_PREFIX = /^(follow-up|跟进追问|追问)\s*[:：]\s*/i;

export function buildHumanOutreachFollowupText(question: unknown): string {
  const original = typeof question === 'string' ? question.trim() : '';
  if (!original) return '';
  const stripped = original.replace(MACHINE_FOLLOWUP_PREFIX, '').trim();
  return stripped || original;
}
