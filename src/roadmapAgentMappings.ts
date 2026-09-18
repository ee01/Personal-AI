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
  warnings?: string[];
};

export type AgentCreateArtifact = {
  partial: boolean;
  mappings: AgentMappingRow[];
};

export type AssignedCreateRow = {
  draftId: string;
  jiraKey?: string;
  error?: string;
  warnings?: string[];
};

function collectWarnings(row: {
  warning?: unknown;
  warnings?: unknown;
  error?: unknown;
  jiraKey?: string;
}): string[] {
  const fromArray = Array.isArray(row.warnings)
    ? row.warnings.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const single = String(row.warning || '').trim();
  const foldedError =
    row.jiraKey && String(row.error || '').trim()
      ? [String(row.error).trim()]
      : [];
  return [...fromArray, ...(single ? [single] : []), ...foldedError];
}

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
  const raw = row as {
    draftId?: unknown;
    jiraKey?: unknown;
    error?: unknown;
    warning?: unknown;
    warnings?: unknown;
  };
  const draftId = String(raw.draftId || '').trim();
  if (!draftId) return null;
  const jiraKey = String(raw.jiraKey || '').trim();
  const error = String(raw.error || '').trim();
  const warnings = collectWarnings({
    warning: raw.warning,
    warnings: raw.warnings,
    error: raw.error,
    jiraKey,
  });
  if (jiraKey) {
    return {
      draftId,
      jiraKey,
      ...(warnings.length ? { warnings } : {}),
    };
  }
  if (error) {
    return {
      draftId,
      error,
      ...(warnings.length ? { warnings } : {}),
    };
  }
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

function assignedFromHit(
  hit: AgentMappingRow | undefined,
  fallback: string,
): Pick<AssignedCreateRow, 'jiraKey' | 'error' | 'warnings'> {
  if (hit?.jiraKey) {
    const warnings = collectWarnings({
      warnings: hit.warnings,
      error: hit.error,
      jiraKey: hit.jiraKey,
    });
    return {
      jiraKey: hit.jiraKey,
      ...(warnings.length ? { warnings } : {}),
    };
  }
  return {
    error: hit?.error || fallback,
    ...(hit?.warnings?.length ? { warnings: hit.warnings } : {}),
  };
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
  parent?: {
    itemKey: string;
    jiraKey?: string;
    error?: string;
    warnings?: string[];
  };
  children: AssignedCreateRow[];
} {
  const byId = mappingIndex(input.mappings);
  const fallback =
    String(input.fallbackError || '').trim() ||
    'Agent 结果未包含该草稿的 mapping';

  const children: AssignedCreateRow[] = input.childDraftIds.map((draftId) => {
    const assigned = assignedFromHit(byId.get(draftId), fallback);
    return { draftId, ...assigned };
  });

  const parentKey = String(input.parentItemKey || '').trim();
  if (!parentKey) return { children };

  const assigned = assignedFromHit(byId.get(parentKey), fallback);
  return {
    parent: { itemKey: parentKey, ...assigned },
    children,
  };
}
