/**
 * FocusProjectContextBuilder
 *
 * Renders the same watched/focus project set into three detail levels:
 * - row: message analysis (token-sensitive)
 * - paragraph: self-reflection
 * - seed: dreaming / recall personalization
 */

export type FocusTier = 'candidate' | 'focus' | 'archived';

export interface FocusProjectRecord {
  id: string;
  entityId?: string;
  name: string;
  displayName?: string;
  aliases?: string[];
  teamRef?: string;
  teamName?: string;
  externalRef?: {
    itemKey?: string;
    jiraKey?: string | null;
    isDraft?: boolean;
    description?: string | null;
  };
  tier: FocusTier;
  priority: number;
  targetStart?: string | null;
  targetEnd?: string | null;
  keywords?: string[];
  /** User / Jira description used in paragraph context, not watch-rule keywords. */
  description?: string | null;
  recentEventSummaries?: string[];
  recentHitCount?: number;
  hasUnresolvedDrift?: boolean;
  lastEngagedAt?: number;
}

export interface FocusBudgetOptions {
  maxTotal?: number;
  perTeamFloor?: number;
}

function displayOf(project: FocusProjectRecord): string {
  return (
    project.displayName ||
    project.aliases?.[0] ||
    truncate(project.name, 12) ||
    project.externalRef?.jiraKey ||
    project.id
  );
}

/**
 * Key safe to put in a prompt. A draft's itemKey is a synthetic LOCAL-… token that
 * means nothing outside roadmap-service, so drafts render by display name instead.
 */
function promptKeyOf(project: FocusProjectRecord, fallback = ''): string {
  if (project.externalRef?.jiraKey) return project.externalRef.jiraKey;
  if (project.externalRef?.isDraft) return '';
  return project.externalRef?.itemKey || fallback;
}

function truncate(text: string, max: number): string {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1))}…`;
}

function targetRange(project: FocusProjectRecord): string {
  if (project.targetStart && project.targetEnd) {
    return `${project.targetStart}→${project.targetEnd}`;
  }
  if (project.targetEnd) return `→${project.targetEnd}`;
  if (project.targetStart) return `${project.targetStart}→`;
  return '';
}

/**
 * Fair multi-team budget: each team keeps a floor, remaining slots by priority.
 */
export function selectFocusProjectsForBudget(
  projects: FocusProjectRecord[],
  options: FocusBudgetOptions = {},
): FocusProjectRecord[] {
  const maxTotal = options.maxTotal ?? 8;
  const perTeamFloor = options.perTeamFloor ?? 1;
  const active = projects
    .filter((p) => p.tier === 'focus')
    .sort((a, b) => b.priority - a.priority || (b.lastEngagedAt || 0) - (a.lastEngagedAt || 0));

  if (active.length <= maxTotal) return active;

  const byTeam = new Map<string, FocusProjectRecord[]>();
  for (const project of active) {
    const team = project.teamRef || '_none';
    const list = byTeam.get(team) || [];
    list.push(project);
    byTeam.set(team, list);
  }

  const selected: FocusProjectRecord[] = [];
  const selectedIds = new Set<string>();

  for (const [, list] of byTeam) {
    for (const project of list.slice(0, perTeamFloor)) {
      if (selected.length >= maxTotal) break;
      selected.push(project);
      selectedIds.add(project.id);
    }
  }

  for (const project of active) {
    if (selected.length >= maxTotal) break;
    if (selectedIds.has(project.id)) continue;
    selected.push(project);
    selectedIds.add(project.id);
  }

  return selected.sort((a, b) => b.priority - a.priority);
}

export function buildFocusRowContext(
  projects: FocusProjectRecord[],
  options?: FocusBudgetOptions,
): string {
  const selected = selectFocusProjectsForBudget(projects, {
    maxTotal: options?.maxTotal ?? 8,
    perTeamFloor: options?.perTeamFloor ?? 1,
  });
  if (!selected.length) return '';

  const lines = selected.map((project, index) => {
    const key = promptKeyOf(project, project.id);
    const alias = displayOf(project);
    const team = project.teamName || project.teamRef || '-';
    const range = targetRange(project);
    const keywords = Array.from(
      new Set([...(project.aliases || []), ...(project.keywords || [])]),
    )
      .filter(Boolean)
      .slice(0, 6)
      .join('/');
    return `${index + 1}. ${key ? `[${key}] ` : ''}${alias} · team=${team}${
      range ? ` · ${range}` : ''
    }${keywords ? ` · keywords=${keywords}` : ''}`;
  });

  return [
    'Focus projects (memory-only, never notify):',
    ...lines,
  ].join('\n');
}

export function buildFocusParagraphContext(
  projects: FocusProjectRecord[],
  options?: FocusBudgetOptions,
): string {
  const selected = selectFocusProjectsForBudget(projects, {
    maxTotal: options?.maxTotal ?? 5,
    perTeamFloor: options?.perTeamFloor ?? 1,
  });
  if (!selected.length) return '';

  const blocks = selected.map((project) => {
    const alias = displayOf(project);
    const key = promptKeyOf(project);
    const team = project.teamName || project.teamRef || '-';
    const range = targetRange(project) || 'no target dates';
    const events = (project.recentEventSummaries || []).slice(0, 3);
    const hits = project.recentHitCount ?? 0;
    const drift = project.hasUnresolvedDrift ? 'unresolved drift' : 'no open drift';
    const notes = String(project.description || '')
      .replace(/\s+/g, ' ')
      .trim();
    return [
      `- ${alias}${key ? ` (${key})` : ''} · team ${team} · ${range}`,
      `  recent hits: ${hits}; ${drift}`,
      events.length ? `  recent events: ${events.join(' | ')}` : '  recent events: none',
      notes
        ? `  notes: ${notes.length > 240 ? `${notes.slice(0, 239)}…` : notes}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return ['Focus project brief:', ...blocks].join('\n');
}

export function buildFocusSeedContext(
  projects: FocusProjectRecord[],
  options?: FocusBudgetOptions,
): Array<{ entityId: string; projectId: string; displayName: string; teamRef?: string }> {
  const selected = selectFocusProjectsForBudget(projects, {
    maxTotal: options?.maxTotal ?? 5,
    perTeamFloor: options?.perTeamFloor ?? 1,
  });
  return selected
    .filter((project) => Boolean(project.entityId))
    .map((project) => ({
      entityId: project.entityId!,
      projectId: project.id,
      displayName: displayOf(project),
      teamRef: project.teamRef,
    }));
}
