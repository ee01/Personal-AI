/**
 * Agent create-Jira artifact contract.
 *
 * Success, partial success, and failed runs all use the same JSON shape.
 * A failed AgentTask that still lists jiraKeys MUST write those rows back;
 * omitting them is what causes duplicate tickets on retry.
 */

export type AgentMappingRow = {
  draftId: string;
  jiraKey?: string;
  error?: string;
};

export type AgentCreateArtifact = {
  partial: boolean;
  mappings: AgentMappingRow[];
};

export type AssignedCreateRow = {
  draftId: string;
  jiraKey?: string;
  error?: string;
};

export function extractJsonObject(text: string): unknown {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* try fenced / embedded JSON */
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function mappingFromRow(row: unknown): AgentMappingRow | null {
  if (!row || typeof row !== 'object') return null;
  const draftId = String((row as { draftId?: unknown }).draftId || '').trim();
  if (!draftId) return null;
  const jiraKey = String((row as { jiraKey?: unknown }).jiraKey || '').trim();
  const error = String((row as { error?: unknown }).error || '').trim();
  if (jiraKey) return { draftId, jiraKey, ...(error ? { error } : {}) };
  if (error) return { draftId, error };
  return null;
}

/**
 * Parse the first candidate that contains a mappings array with at least one
 * usable row (jiraKey or error). Older artifacts without `partial` / `error`
 * still parse.
 */
export function parseAgentCreateArtifact(
  ...candidates: Array<string | null | undefined>
): AgentCreateArtifact {
  for (const candidate of candidates) {
    const parsed = extractJsonObject(candidate || '');
    if (!parsed || typeof parsed !== 'object') continue;
    const raw = parsed as { partial?: unknown; mappings?: unknown };
    if (!Array.isArray(raw.mappings)) continue;
    const mappings: AgentMappingRow[] = [];
    for (const row of raw.mappings) {
      const mapped = mappingFromRow(row);
      if (mapped) mappings.push(mapped);
    }
    if (!mappings.length) continue;
    const declaredPartial = raw.partial === true;
    const hasError = mappings.some((m) => !m.jiraKey);
    return { partial: declaredPartial || hasError, mappings };
  }
  return { partial: false, mappings: [] };
}

export function mappingIndex(
  mappings: AgentMappingRow[],
): Map<string, AgentMappingRow> {
  const byId = new Map<string, AgentMappingRow>();
  for (const row of mappings) {
    const prev = byId.get(row.draftId);
    if (!prev || (row.jiraKey && !prev.jiraKey)) byId.set(row.draftId, row);
  }
  return byId;
}

/**
 * Assign parsed mappings onto the requested parent/children. Missing rows get
 * fallbackError so the UI never treats "Agent failed" as wiping already-known keys.
 */
export function assignMappingsToRows(input: {
  parentItemKey?: string | null;
  childDraftIds: string[];
  mappings: AgentMappingRow[];
  fallbackError: string;
}): {
  parent?: { itemKey: string; jiraKey?: string; error?: string };
  children: AssignedCreateRow[];
} {
  const byId = mappingIndex(input.mappings);
  const fallback =
    String(input.fallbackError || '').trim() ||
    'Agent 结果未包含该草稿的 mapping';

  const children: AssignedCreateRow[] = input.childDraftIds.map((draftId) => {
    const hit = byId.get(draftId);
    if (hit?.jiraKey) return { draftId, jiraKey: hit.jiraKey };
    return { draftId, error: hit?.error || fallback };
  });

  const parentKey = String(input.parentItemKey || '').trim();
  if (!parentKey) return { children };

  const hit = byId.get(parentKey);
  if (hit?.jiraKey) {
    return {
      parent: { itemKey: parentKey, jiraKey: hit.jiraKey },
      children,
    };
  }
  return {
    parent: { itemKey: parentKey, error: hit?.error || fallback },
    children,
  };
}
