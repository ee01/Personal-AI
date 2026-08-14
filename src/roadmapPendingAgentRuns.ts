/**
 * Client-side ledger for Prompt/Agent create-Jira runs.
 *
 * memory-service keeps running after the Roadmap tab closes; the content
 * script's runtime-status poll does not. Persist enough to resume writeback
 * the next time this browser opens the Roadmap page.
 */

export const ROADMAP_PENDING_AGENT_RUNS_KEY = 'roadmapPendingAgentCreates';
export const PENDING_AGENT_RUN_TTL_MS = 24 * 60 * 60 * 1000;

export type PendingAgentCreateParent = {
  itemKey: string;
  issueType?: string | null;
  projectKey?: string | null;
};

export type PendingAgentCreateRun = {
  taskId: string;
  teamId: string;
  token: string | null;
  parent: PendingAgentCreateParent | null;
  childDraftIds: string[];
  startedAt: number;
};

export function normalizePendingAgentCreateRun(
  raw: unknown,
): PendingAgentCreateRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const taskId = String(row.taskId || '').trim();
  const teamId = String(row.teamId || '').trim();
  const startedAt = Number(row.startedAt);
  if (!taskId || !teamId || !Number.isFinite(startedAt) || startedAt <= 0) {
    return null;
  }
  const parentRaw = row.parent;
  let parent: PendingAgentCreateParent | null = null;
  if (parentRaw && typeof parentRaw === 'object') {
    const itemKey = String(
      (parentRaw as { itemKey?: unknown }).itemKey || '',
    ).trim();
    if (itemKey) {
      parent = {
        itemKey,
        issueType: String(
          (parentRaw as { issueType?: unknown }).issueType || '',
        ).trim() || null,
        projectKey: String(
          (parentRaw as { projectKey?: unknown }).projectKey || '',
        ).trim() || null,
      };
    }
  }
  const childDraftIds = Array.isArray(row.childDraftIds)
    ? row.childDraftIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const token =
    typeof row.token === 'string' && row.token.trim() ? row.token : null;
  return { taskId, teamId, token, parent, childDraftIds, startedAt };
}

export function upsertPendingAgentCreateRun(
  list: PendingAgentCreateRun[],
  run: PendingAgentCreateRun,
): PendingAgentCreateRun[] {
  const next = list.filter((row) => row.taskId !== run.taskId);
  next.push(run);
  return next;
}

export function removePendingAgentCreateRun(
  list: PendingAgentCreateRun[],
  taskId: string,
): PendingAgentCreateRun[] {
  const id = String(taskId || '').trim();
  return list.filter((row) => row.taskId !== id);
}

export function remainingAgentPollMs(input: {
  startedAt: number;
  now?: number;
  budgetMs: number;
  minMs?: number;
}): number {
  const now = input.now ?? Date.now();
  const leftover = input.budgetMs - (now - input.startedAt);
  if (leftover > 0) return leftover;
  return Math.max(0, input.minMs ?? 0);
}

export function partitionPendingAgentCreateRuns(
  list: PendingAgentCreateRun[],
  now = Date.now(),
  ttlMs = PENDING_AGENT_RUN_TTL_MS,
): { active: PendingAgentCreateRun[]; expired: PendingAgentCreateRun[] } {
  const active: PendingAgentCreateRun[] = [];
  const expired: PendingAgentCreateRun[] = [];
  for (const run of list) {
    if (now - run.startedAt > ttlMs) expired.push(run);
    else active.push(run);
  }
  return { active, expired };
}

function readList(raw: unknown): PendingAgentCreateRun[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingAgentCreateRun[] = [];
  for (const row of raw) {
    const parsed = normalizePendingAgentCreateRun(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function loadPendingAgentCreateRuns(): Promise<
  PendingAgentCreateRun[]
> {
  try {
    const stored = await chrome.storage.local.get(ROADMAP_PENDING_AGENT_RUNS_KEY);
    return readList(stored?.[ROADMAP_PENDING_AGENT_RUNS_KEY]);
  } catch {
    return [];
  }
}

export async function savePendingAgentCreateRuns(
  list: PendingAgentCreateRun[],
): Promise<void> {
  await chrome.storage.local.set({ [ROADMAP_PENDING_AGENT_RUNS_KEY]: list });
}

export async function rememberPendingAgentCreateRun(
  run: PendingAgentCreateRun,
): Promise<void> {
  const list = await loadPendingAgentCreateRuns();
  await savePendingAgentCreateRuns(upsertPendingAgentCreateRun(list, run));
}

export async function forgetPendingAgentCreateRun(taskId: string): Promise<void> {
  const list = await loadPendingAgentCreateRuns();
  await savePendingAgentCreateRuns(removePendingAgentCreateRun(list, taskId));
}
