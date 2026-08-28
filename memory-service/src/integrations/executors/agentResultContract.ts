/**
 * Shared Agent Result Contract — verifiable artifact checks used by all executors.
 * Extracted from OpenClawDelegationService so Gateway / ACP / legacy share one rule.
 */

export interface AgentResultArtifact {
  kind: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Accept string[] or object shapes for observed/changed fields.
 * OpenClaw sometimes returns `{"url":"...","tabId":...}` instead of `["url","tabId"]`.
 * Objects are normalized via Object.keys / key=value before emptiness checks.
 */
export function normalizeObservedFieldLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return Object.entries(item as Record<string, unknown>)
            .map(([key, entryValue]) =>
              entryValue === undefined || entryValue === null
                ? key
                : `${key}=${String(entryValue)}`,
            )
            .join(',');
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        return '';
      })
      .filter((item) => item.length > 0);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        if (entryValue === undefined || entryValue === null || entryValue === '') {
          return key;
        }
        if (
          typeof entryValue === 'string' ||
          typeof entryValue === 'number' ||
          typeof entryValue === 'boolean'
        ) {
          return `${key}=${String(entryValue)}`;
        }
        return key;
      })
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function hasMetadataObservedFields(
  metadata: Record<string, unknown> | undefined,
  keys: string[] = ['observedFields', 'changedFields'],
): boolean {
  if (!metadata) return false;
  return keys.some((key) => normalizeObservedFieldLabels(metadata[key]).length > 0);
}

/**
 * A task can legitimately touch zero entities — a conditional sync that finds no
 * qualifying record, a scan that comes back clean. That is a verified negative
 * result, not a missing receipt, so it needs its own artifact shape: `kind:
 * 'query_result'` (or an explicit `metadata.matchCount === 0`) backed by the
 * query that was run and how it was executed, instead of an entity identity.
 */
export function isVerifiedEmptyResultArtifact(artifact: AgentResultArtifact): boolean {
  const metadata = artifact.metadata;
  const kind = typeof artifact.kind === 'string' ? artifact.kind.trim().toLowerCase() : '';
  const matchCount = metadata?.matchCount;
  const isZeroMatch =
    kind === 'query_result' ||
    matchCount === 0 ||
    matchCount === '0';
  if (!isZeroMatch) return false;

  const sourceSystem = getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']);
  const query = getMetadataString(metadata, ['query', 'jql', 'queryText']);
  const verification =
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
  const hasBody =
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

  return Boolean(sourceSystem && query && verification && hasBody);
}

function hasVerifiableEntityArtifact(
  artifact: AgentResultArtifact,
  options: { targetSystem?: string },
): boolean {
  const metadata = artifact.metadata;
  const sourceSystem =
    getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']) ??
    options.targetSystem?.trim();
  const entityId = getMetadataString(metadata, [
    'entityId',
    'entityKey',
    'recordId',
    'resourceId',
    'ticketId',
    'ticketKey',
    'issueKey',
  ]);
  const verification =
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
  const hasObservedFields = hasMetadataObservedFields(metadata);
  const hasOperation = Boolean(
    getMetadataString(metadata, ['operation', 'operationType', 'action']),
  );
  const hasObservedAt = Boolean(
    getMetadataString(metadata, ['observedAt', 'verifiedAt', 'updatedAt']),
  );
  const hasBody =
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

  return Boolean(
    sourceSystem &&
      entityId &&
      verification &&
      hasBody &&
      (hasObservedFields || hasOperation || hasObservedAt),
  );
}

export function hasVerifiableArtifact(
  artifacts: AgentResultArtifact[],
  options: { targetSystem?: string } = {},
): boolean {
  return artifacts.some(
    (artifact) =>
      hasVerifiableEntityArtifact(artifact, options) ||
      isVerifiedEmptyResultArtifact(artifact),
  );
}
